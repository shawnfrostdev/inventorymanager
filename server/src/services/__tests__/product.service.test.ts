import { PrismaClient } from '@prisma/client';
import { ProductService } from '../product.service';
import { createTestUser, createTestProduct, createTestCustomer, createTestOrder } from '../../test/setup';

const productService = new ProductService();
let testDb: PrismaClient;
let testUser: any;

beforeAll(async () => {
  testDb = new PrismaClient();
  await testDb.$connect();
});

afterAll(async () => {
  await testDb.$disconnect();
});

beforeEach(async () => {
  // Create test user
  testUser = await createTestUser();
});

afterEach(async () => {
  // Clean up test data
  await testDb.stockMovement.deleteMany({});
  await testDb.product.deleteMany({});
  await testDb.category.deleteMany({});
  await testDb.user.deleteMany({});
});

describe('ProductService', () => {
  describe('Product CRUD Operations', () => {
    it('should create a new product', async () => {
      // Create a category first
      const category = await testDb.category.create({
        data: { name: 'Test Category', description: 'Test description' }
      });

      const productData = {
        name: 'Test Product',
        description: 'Test product description',
        sku: 'TEST-001',
        barcode: '1234567890',
        price: 99.99,
        cost: 50.00,
        quantity: 100,
        minQuantity: 10,
        categoryId: category.id,
        trackBatches: false,
      };

      const result = await productService.createProduct(productData, testUser.id);

      expect(result).toBeDefined();
      expect(result.name).toBe(productData.name);
      expect(result.sku).toBe(productData.sku);
      expect(result.userId).toBe(testUser.id);
    });

    it('should not create product with duplicate SKU', async () => {
      // Create a category first
      const category = await testDb.category.create({
        data: { name: 'Test Category 2', description: 'Test description' }
      });

      const productData = {
        name: 'Test Product 1',
        sku: 'DUPLICATE-SKU',
        price: 99.99,
        cost: 50.00,
        quantity: 100,
        minQuantity: 10,
        categoryId: category.id,
      };

      await productService.createProduct(productData, testUser.id);

      const duplicateData = {
        ...productData,
        name: 'Test Product 2',
      };

      await expect(
        productService.createProduct(duplicateData, testUser.id)
      ).rejects.toThrow('SKU already exists');
    });

    it('should get all products', async () => {
      const product1 = await createTestProduct(testUser.id, { name: 'Product 1' });
      const product2 = await createTestProduct(testUser.id, { name: 'Product 2' });

      const result = await productService.getProducts({});

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThanOrEqual(2);
    });

    it('should search products by name', async () => {
      await createTestProduct(testUser.id, { name: 'Apple iPhone' });
      await createTestProduct(testUser.id, { name: 'Samsung Galaxy' });

      const result = await productService.getProducts({ search: 'Apple' });

      expect(result).toBeDefined();
      expect(result.length).toBe(1);
      expect(result[0].name).toContain('Apple');
    });

    it('should filter products by category', async () => {
      const category = await testDb.category.create({
        data: { name: 'Electronics', description: 'Electronic items' }
      });

      const otherCategory = await testDb.category.create({
        data: { name: 'Other Category', description: 'Other items' }
      });

      await createTestProduct(testUser.id, { 
        name: 'Product 1', 
        categoryId: category.id 
      });
      await createTestProduct(testUser.id, { 
        name: 'Product 2', 
        categoryId: otherCategory.id 
      });

      const result = await productService.getProducts({ categoryId: category.id });

      expect(result).toBeDefined();
      expect(result.length).toBe(1);
      expect(result[0].categoryId).toBe(category.id);
    });

    it('should get product by ID', async () => {
      const product = await createTestProduct(testUser.id);

      const result = await productService.getProductById(product.id);

      expect(result).toBeDefined();
      expect(result?.id).toBe(product.id);
      expect(result?.name).toBe(product.name);
    });

    it('should return null for non-existent product', async () => {
      const result = await productService.getProductById('non-existent-id');

      expect(result).toBeNull();
    });

    it('should update a product', async () => {
      const product = await createTestProduct(testUser.id);
      const updateData = {
        name: 'Updated Product',
        price: 149.99,
        quantity: 150,
      };

      const result = await productService.updateProduct(product.id, updateData);

      expect(result).toBeDefined();
      expect(result.name).toBe(updateData.name);
      expect(result.price).toBe(updateData.price);
      expect(result.quantity).toBe(updateData.quantity);
    });

    it('should throw error when updating non-existent product', async () => {
      const updateData = {
        name: 'Updated Product',
        price: 149.99,
      };

      await expect(
        productService.updateProduct('non-existent-id', updateData)
      ).rejects.toThrow();
    });

    it('should delete a product', async () => {
      const product = await createTestProduct(testUser.id);

      await productService.deleteProduct(product.id);

      const deletedProduct = await testDb.product.findUnique({
        where: { id: product.id }
      });
      expect(deletedProduct).toBeNull();
    });

    it('should throw error when deleting non-existent product', async () => {
      await expect(
        productService.deleteProduct('non-existent-id')
      ).rejects.toThrow();
    });
  });

  describe('Stock Movement Operations', () => {
    it('should create stock movement and update product quantity', async () => {
      const product = await createTestProduct(testUser.id, { quantity: 100 });
      
      const movementData = {
        productId: product.id,
        type: 'IN' as const,
        quantity: 50,
        reason: 'Stock replenishment',
      };

      const result = await productService.createStockMovement(movementData, testUser.id);

      expect(result).toBeDefined();
      expect(result.productId).toBe(product.id);
      expect(result.type).toBe('IN');
      expect(result.quantity).toBe(50);

      // Check if product quantity was updated
      const updatedProduct = await testDb.product.findUnique({
        where: { id: product.id }
      });
      expect(updatedProduct?.quantity).toBe(150); // 100 + 50
    });

    it('should prevent stock movement with insufficient quantity', async () => {
      const product = await createTestProduct(testUser.id, { quantity: 10 });
      
      const movementData = {
        productId: product.id,
        type: 'OUT' as const,
        quantity: 20, // More than available
        reason: 'Sale',
      };

      await expect(
        productService.createStockMovement(movementData, testUser.id)
      ).rejects.toThrow('Insufficient stock');
    });

    it('should get stock movements for a product', async () => {
      const product = await createTestProduct(testUser.id);
      
      await productService.createStockMovement({
        productId: product.id,
        type: 'IN',
        quantity: 50,
        reason: 'Initial stock',
      }, testUser.id);

      const movements = await productService.getStockMovements(product.id);

      expect(movements).toBeDefined();
      expect(Array.isArray(movements)).toBe(true);
      expect(movements.length).toBeGreaterThan(0);
    });
  });

  describe('Category Operations', () => {
    it('should create a new category', async () => {
      const categoryData = {
        name: 'Electronics',
        description: 'Electronic devices and accessories',
      };

      const result = await productService.createCategory(categoryData);

      expect(result).toBeDefined();
      expect(result.name).toBe(categoryData.name);
      expect(result.description).toBe(categoryData.description);
    });

    it('should not create category with duplicate name', async () => {
      const categoryData = {
        name: 'Electronics',
        description: 'Electronic devices',
      };

      await productService.createCategory(categoryData);

      await expect(
        productService.createCategory(categoryData)
      ).rejects.toThrow('Category name already exists');
    });

    it('should get all categories', async () => {
      await testDb.category.create({
        data: { name: 'Category 1', description: 'Description 1' }
      });
      await testDb.category.create({
        data: { name: 'Category 2', description: 'Description 2' }
      });

      const result = await productService.getCategories();

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThanOrEqual(2);
    });

    it('should update a category', async () => {
      const category = await testDb.category.create({
        data: { name: 'Original Name', description: 'Original description' }
      });

      const updateData = {
        name: 'Updated Name',
        description: 'Updated description',
      };

      const result = await productService.updateCategory(category.id, updateData);

      expect(result).toBeDefined();
      expect(result.name).toBe(updateData.name);
      expect(result.description).toBe(updateData.description);
    });

    it('should delete a category', async () => {
      const category = await testDb.category.create({
        data: { name: 'Test Category', description: 'Test description' }
      });

      await productService.deleteCategory(category.id);

      const deletedCategory = await testDb.category.findUnique({
        where: { id: category.id }
      });
      expect(deletedCategory).toBeNull();
    });

    it('should not delete category with existing products', async () => {
      const category = await testDb.category.create({
        data: { name: 'Category with Products', description: 'Test category' }
      });

      await createTestProduct(testUser.id, { categoryId: category.id });

      await expect(
        productService.deleteCategory(category.id)
      ).rejects.toThrow('Cannot delete category with existing products');
    });
  });
}); 