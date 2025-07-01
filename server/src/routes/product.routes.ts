import { Router } from 'express';
import * as productController from '../controllers/product.controller';
import { validateRequest } from '../middleware/validateRequest';
import { createProductSchema, updateProductSchema, createCategorySchema, updateCategorySchema, createStockMovementSchema } from '../types/product.types';
import { upload } from '../utils/s3';
import { protect as authMiddleware } from '../middleware/authMiddleware';

const router = Router();

// Category routes (MUST come before /:id routes to avoid conflicts)
router.post('/categories', 
  authMiddleware,
  validateRequest(createCategorySchema),
  productController.createCategory
);

router.get('/categories', 
  authMiddleware,
  productController.getCategories
);

router.put('/categories/:id', 
  authMiddleware,
  validateRequest(updateCategorySchema),
  productController.updateCategory
);

router.delete('/categories/:id', 
  authMiddleware,
  productController.deleteCategory
);

// Stock Movement routes (MUST come before /:id routes to avoid conflicts)
router.post('/stock-movements', 
  authMiddleware,
  validateRequest(createStockMovementSchema),
  productController.createStockMovement
);

router.get('/stock-movements/:productId', 
  authMiddleware,
  productController.getStockMovements
);

// Product routes (parameterized routes MUST come last)
router.post('/', 
  authMiddleware,
  upload.single('image'),
  validateRequest(createProductSchema),
  productController.createProduct
);

router.get('/', 
  authMiddleware,
  productController.getProducts
);

router.get('/:id', 
  authMiddleware,
  productController.getProduct
);

router.put('/:id', 
  authMiddleware,
  upload.single('image'),
  validateRequest(updateProductSchema),
  productController.updateProduct
);

router.delete('/:id', 
  authMiddleware,
  productController.deleteProduct
);

export default router; 