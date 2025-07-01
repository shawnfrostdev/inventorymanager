import { Request, Response, NextFunction } from 'express';
import { ProductService } from '../services/product.service';
import { createProductSchema, updateProductSchema, createCategorySchema, updateCategorySchema, createStockMovementSchema } from '../types/product.types';
import { S3Service } from '../utils/s3';
import { AppError } from '../utils/error';

const productService = new ProductService();

type AsyncRequestHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;

// Helper function to catch errors
const catchAsync = (fn: AsyncRequestHandler): ((req: Request, res: Response, next: NextFunction) => void) => {
  return function(req: Request, res: Response, next: NextFunction) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export const createProduct = catchAsync(async (req, res) => {
  const userId = req.user!.id;
  let imageUrl;

  if (req.file) {
    imageUrl = await S3Service.uploadFile(req.file);
  }

  const product = await productService.createProduct({ ...req.body, imageUrl }, userId);
  
  res.status(201).json({
    status: 'success',
    data: product,
    message: 'Product created successfully',
  });
});

export const getProducts = catchAsync(async (req, res) => {
  const { search, categoryId } = req.query;
  
  const products = await productService.getProducts({
    search: search as string,
    categoryId: categoryId as string,
  });

  res.json({
    status: 'success',
    data: products,
    message: 'Products retrieved successfully',
  });
});

export const getProduct = catchAsync(async (req, res) => {
  const { id } = req.params;
  
  const product = await productService.getProductById(id);

  if (!product) {
    throw new AppError('Product not found', 404);
  }

  res.json({
    status: 'success',
    data: product,
    message: 'Product retrieved successfully',
  });
});

export const updateProduct = catchAsync(async (req, res) => {
  const { id } = req.params;
  const userId = req.user?.id; // Get user ID from authenticated request
  let imageUrl;

  if (req.file) {
    imageUrl = await S3Service.uploadFile(req.file);
  }

  const product = await productService.updateProduct(id, { ...req.body, imageUrl }, userId);
  
  res.json({
    status: 'success',
    data: product,
    message: 'Product updated successfully',
  });
});

export const deleteProduct = catchAsync(async (req, res) => {
  const { id } = req.params;
  const userId = req.user?.id; // Get user ID from authenticated request
  
  await productService.deleteProduct(id, userId);
  
  res.json({
    status: 'success',
    message: 'Product deleted successfully',
  });
});

export const createCategory = catchAsync(async (req, res) => {
  const category = await productService.createCategory(req.body);
  
  res.status(201).json({
    status: 'success',
    data: category,
    message: 'Category created successfully',
  });
});

export const getCategories = catchAsync(async (req, res) => {
  const categories = await productService.getCategories();
  
  res.json({
    status: 'success',
    data: categories,
    message: 'Categories retrieved successfully',
  });
});

export const updateCategory = catchAsync(async (req, res) => {
  const { id } = req.params;
  const category = await productService.updateCategory(id, req.body);
  
  res.json({
    status: 'success',
    data: category,
    message: 'Category updated successfully',
  });
});

export const deleteCategory = catchAsync(async (req, res) => {
  const { id } = req.params;
  await productService.deleteCategory(id);
  
  res.json({
    status: 'success',
    message: 'Category deleted successfully',
  });
});

export const createStockMovement = catchAsync(async (req, res) => {
  const userId = req.user!.id;
  const movement = await productService.createStockMovement(req.body, userId);
  
  res.status(201).json({
    status: 'success',
    data: movement,
    message: 'Stock movement created successfully',
  });
});

export const getStockMovements = catchAsync(async (req, res) => {
  const { productId } = req.params;
  const movements = await productService.getStockMovements(productId);
  
  res.json({
    status: 'success',
    data: movements,
    message: 'Stock movements retrieved successfully',
  });
}); 