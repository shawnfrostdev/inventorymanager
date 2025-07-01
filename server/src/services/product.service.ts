import { PrismaClient, Product, Category, StockMovement } from '@prisma/client';
import { CreateProductDto, UpdateProductDto, CreateCategoryDto, UpdateCategoryDto, CreateStockMovementDto } from '../types/product.types';
import { AppError } from '../utils/error';
import { socketService } from './socket.service';

const prisma = new PrismaClient();

export class ProductService {
  // Product CRUD operations
  async createProduct(data: CreateProductDto, userId: string): Promise<Product> {
    const existingSku = await prisma.product.findUnique({ where: { sku: data.sku } });
    if (existingSku) {
      throw new AppError('SKU already exists', 400);
    }

    if (data.barcode) {
      const existingBarcode = await prisma.product.findUnique({ where: { barcode: data.barcode } });
      if (existingBarcode) {
        throw new AppError('Barcode already exists', 400);
      }
    }

    return prisma.product.create({
      data: {
        ...data,
        userId,
      },
    });
  }

  async getProducts(query: { search?: string; categoryId?: string; userId?: string } = {}): Promise<Product[]> {
    const where: any = {};
    
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { sku: { contains: query.search, mode: 'insensitive' } },
        { barcode: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.categoryId) {
      where.categoryId = query.categoryId;
    }

    return prisma.product.findMany({
      where,
      include: {
        category: true,
      },
    });
  }

  async getProductById(id: string, userId?: string): Promise<Product | null> {
    return prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        stockMovements: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });
  }

  async updateProduct(id: string, data: UpdateProductDto, userId?: string): Promise<Product> {
    if (data.sku) {
      const existingSku = await prisma.product.findFirst({
        where: { sku: data.sku, NOT: { id } },
      });
      if (existingSku) {
        throw new AppError('SKU already exists', 400);
      }
    }

    if (data.barcode) {
      const existingBarcode = await prisma.product.findFirst({
        where: { barcode: data.barcode, NOT: { id } },
      });
      if (existingBarcode) {
        throw new AppError('Barcode already exists', 400);
      }
    }

    const where: any = { id };
    if (userId) {
      where.userId = userId;
    }

    return prisma.product.update({
      where,
      data,
    });
  }

  async deleteProduct(id: string, userId?: string): Promise<void> {
    const where: any = { id };
    if (userId) {
      where.userId = userId;
    }
    await prisma.product.delete({ where });
  }

  // Category CRUD operations
  async createCategory(data: CreateCategoryDto): Promise<Category> {
    const existing = await prisma.category.findUnique({ where: { name: data.name } });
    if (existing) {
      throw new AppError('Category name already exists', 400);
    }

    return prisma.category.create({ data });
  }

  async getCategories(): Promise<Category[]> {
    return prisma.category.findMany({
      include: {
        _count: {
          select: { products: true },
        },
      },
    });
  }

  async updateCategory(id: string, data: UpdateCategoryDto): Promise<Category> {
    if (data.name) {
      const existing = await prisma.category.findFirst({
        where: { name: data.name, NOT: { id } },
      });
      if (existing) {
        throw new AppError('Category name already exists', 400);
      }
    }

    return prisma.category.update({
      where: { id },
      data,
    });
  }

  async deleteCategory(id: string): Promise<void> {
    const productsCount = await prisma.product.count({ where: { categoryId: id } });
    if (productsCount > 0) {
      throw new AppError('Cannot delete category with existing products', 400);
    }

    await prisma.category.delete({ where: { id } });
  }

  // Stock Movement operations
  async createStockMovement(data: CreateStockMovementDto, userId: string): Promise<StockMovement> {
    return prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: data.productId } });
      if (!product) {
        throw new AppError('Product not found', 404);
      }

      const oldQuantity = product.quantity;
      let newQuantity = product.quantity;
      if (data.type === 'IN') {
        newQuantity += data.quantity;
      } else if (data.type === 'OUT') {
        if (product.quantity < data.quantity) {
          throw new AppError('Insufficient stock', 400);
        }
        newQuantity -= data.quantity;
      } else if (data.type === 'ADJUSTMENT') {
        newQuantity = data.quantity;
      }

      await tx.product.update({
        where: { id: data.productId },
        data: { quantity: newQuantity },
      });

      const stockMovement = await tx.stockMovement.create({
        data: {
          ...data,
          userId,
        },
      });

      // Emit real-time stock update notification
      socketService.emitStockUpdate({
        productId: product.id,
        productName: product.name,
        oldQuantity,
        newQuantity,
        updatedBy: userId,
        timestamp: new Date(),
      });

      // Check for low stock and emit alert if needed
      if (newQuantity <= (product.minStock || 0) && newQuantity > 0) {
        socketService.emitLowStockAlert({
          productId: product.id,
          productName: product.name,
          currentStock: newQuantity,
          minStock: product.minStock || 0,
        });
      }

      return stockMovement;
    });
  }

  async getStockMovements(productId: string): Promise<StockMovement[]> {
    return prisma.stockMovement.findMany({
      where: { productId },
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }
} 