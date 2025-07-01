import { Request, Response } from 'express';
import { z } from 'zod';
import { locationService } from '../services/location.service';
import { AppError } from '../utils/error';
import { logger } from '../utils/logger';

// Validation schemas
const createLocationSchema = z.object({
  name: z.string().min(1, 'Location name is required').max(100, 'Location name too long'),
  description: z.string().optional(),
  address: z.string().optional(),
});

const updateLocationSchema = z.object({
  name: z.string().min(1, 'Location name is required').max(100, 'Location name too long').optional(),
  description: z.string().optional(),
  address: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const locationController = {
  async createLocation(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError('User not authenticated', 401);
      }

      const validatedData = createLocationSchema.parse(req.body);
      
      const location = await locationService.createLocation(userId, validatedData);

      res.status(201).json({
        status: 'success',
        data: { location },
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
        logger.error('Error creating location:', error);
        res.status(500).json({
          status: 'error',
          message: 'Internal server error',
        });
      }
    }
  },

  async getLocations(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError('User not authenticated', 401);
      }

      const locations = await locationService.getLocations(userId);

      res.json({
        status: 'success',
        data: { locations },
      });
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          status: 'error',
          message: error.message,
        });
      } else {
        logger.error('Error fetching locations:', error);
        res.status(500).json({
          status: 'error',
          message: 'Internal server error',
        });
      }
    }
  },

  async getLocationById(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError('User not authenticated', 401);
      }

      const { id } = req.params;
      const location = await locationService.getLocationById(userId, id);

      res.json({
        status: 'success',
        data: { location },
      });
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          status: 'error',
          message: error.message,
        });
      } else {
        logger.error('Error fetching location:', error);
        if (error instanceof Error && error.message === 'Location not found') {
          res.status(404).json({
            status: 'error',
            message: 'Location not found',
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

  async updateLocation(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError('User not authenticated', 401);
      }

      const { id } = req.params;
      const validatedData = updateLocationSchema.parse(req.body);

      const location = await locationService.updateLocation(userId, id, validatedData);

      res.json({
        status: 'success',
        data: { location },
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
        logger.error('Error updating location:', error);
        if (error instanceof Error && error.message === 'Location not found') {
          res.status(404).json({
            status: 'error',
            message: 'Location not found',
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

  async deleteLocation(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError('User not authenticated', 401);
      }

      const { id } = req.params;
      await locationService.deleteLocation(userId, id);

      res.json({
        status: 'success',
        message: 'Location deleted successfully',
      });
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          status: 'error',
          message: error.message,
        });
      } else {
        logger.error('Error deleting location:', error);
        if (error instanceof Error) {
          if (error.message === 'Location not found') {
            res.status(404).json({
              status: 'error',
              message: 'Location not found',
            });
          } else if (error.message.includes('Cannot delete location with existing stock')) {
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

  async getLocationStock(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError('User not authenticated', 401);
      }

      const { id } = req.params;
      const stock = await locationService.getLocationStock(userId, id);

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
        logger.error('Error fetching location stock:', error);
        if (error instanceof Error && error.message === 'Location not found') {
          res.status(404).json({
            status: 'error',
            message: 'Location not found',
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
}; 