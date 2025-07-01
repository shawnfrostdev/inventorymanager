import { Request, Response } from 'express';
import { z } from 'zod';
import { transferService } from '../services/transfer.service';
import { AppError } from '../utils/error';
import { logger } from '../utils/logger';

// Validation schemas
const transferStockSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  fromLocationId: z.string().min(1, 'Source location ID is required'),
  toLocationId: z.string().min(1, 'Destination location ID is required'),
  quantity: z.number().int().positive('Quantity must be a positive integer'),
  reason: z.string().optional(),
});

const transferHistoryQuerySchema = z.object({
  productId: z.string().optional(),
  locationId: z.string().optional(),
  limit: z.string().transform((val) => parseInt(val) || 50).optional(),
  offset: z.string().transform((val) => parseInt(val) || 0).optional(),
});

export const transferController = {
  async transferStock(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError('User not authenticated', 401);
      }

      const validatedData = transferStockSchema.parse(req.body);
      
      const result = await transferService.transferStock(userId, validatedData);

      res.status(201).json({
        status: 'success',
        data: result,
        message: 'Stock transfer completed successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          status: 'error',
          message: 'Validation error',
          errors: error.errors,
        });
      } else if (error instanceof AppError) {
        res.status(error.statusCode).json({
          status: 'error',
          message: error.message,
        });
      } else {
        logger.error('Error during stock transfer:', error);
        if (error instanceof Error) {
          // Handle specific business logic errors
          if (
            error.message.includes('not found') ||
            error.message.includes('Insufficient stock') ||
            error.message.includes('Cannot transfer stock to the same location')
          ) {
            res.status(400).json({
              status: 'error',
              message: error.message,
            });
          } else {
            res.status(500).json({
              status: 'error',
              message: 'Internal server error',
            });
          }
        } else {
          res.status(500).json({
            status: 'error',
            message: 'Internal server error',
          });
        }
      }
    }
  },

  async getTransferHistory(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError('User not authenticated', 401);
      }

      const validatedQuery = transferHistoryQuerySchema.parse(req.query);
      
      const result = await transferService.getTransferHistory(userId, validatedQuery);

      res.json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          status: 'error',
          message: 'Validation error',
          errors: error.errors,
        });
      } else if (error instanceof AppError) {
        res.status(error.statusCode).json({
          status: 'error',
          message: error.message,
        });
      } else {
        logger.error('Error fetching transfer history:', error);
        res.status(500).json({
          status: 'error',
          message: 'Internal server error',
        });
      }
    }
  },

  async getTransferById(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError('User not authenticated', 401);
      }

      const { id } = req.params;
      const transfer = await transferService.getTransferById(userId, id);

      res.json({
        status: 'success',
        data: { transfer },
      });
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          status: 'error',
          message: error.message,
        });
      } else {
        logger.error('Error fetching transfer:', error);
        if (error instanceof Error && error.message === 'Transfer not found') {
          res.status(404).json({
            status: 'error',
            message: 'Transfer not found',
          });
        } else {
          res.status(500).json({
            status: 'error',
            message: 'Internal server error',
          });
        }
      }
    }
  },

  async getLocationStockLevel(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError('User not authenticated', 401);
      }

      const { productId, locationId } = req.params;
      
      const stock = await transferService.getLocationStockLevel(userId, productId, locationId);

      res.json({
        status: 'success',
        data: { stock },
      });
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          status: 'error',
          message: error.message,
        });
      } else {
        logger.error('Error fetching stock level:', error);
        res.status(500).json({
          status: 'error',
          message: 'Internal server error',
        });
      }
    }
  },
}; 