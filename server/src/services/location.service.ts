import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export interface CreateLocationData {
  name: string;
  description?: string;
  address?: string;
}

export interface UpdateLocationData {
  name?: string;
  description?: string;
  address?: string;
  isActive?: boolean;
}

export const locationService = {
  async createLocation(userId: string, data: CreateLocationData) {
    try {
      logger.info('Creating new location', { userId, locationName: data.name });
      
      const location = await prisma.location.create({
        data: {
          ...data,
          userId,
        },
      });

      logger.info('Location created successfully', { locationId: location.id });
      return location;
    } catch (error) {
      logger.error('Error creating location:', error);
      throw error;
    }
  },

  async getLocations(userId: string) {
    try {
      logger.info('Fetching locations for user', { userId });
      
      const locations = await prisma.location.findMany({
        where: {
          userId,
          isActive: true,
        },
        include: {
          productStocks: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                },
              },
            },
          },
          _count: {
            select: {
              productStocks: true,
            },
          },
        },
        orderBy: {
          name: 'asc',
        },
      });

      logger.info('Locations fetched successfully', { count: locations.length });
      return locations;
    } catch (error) {
      logger.error('Error fetching locations:', error);
      throw error;
    }
  },

  async getLocationById(userId: string, locationId: string) {
    try {
      logger.info('Fetching location by ID', { userId, locationId });
      
      const location = await prisma.location.findFirst({
        where: {
          id: locationId,
          userId,
        },
        include: {
          productStocks: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                  price: true,
                  cost: true,
                  minQuantity: true,
                },
              },
            },
          },
          _count: {
            select: {
              productStocks: true,
              stockMovementsFrom: true,
              stockMovementsTo: true,
            },
          },
        },
      });

      if (!location) {
        throw new Error('Location not found');
      }

      logger.info('Location found successfully', { locationId });
      return location;
    } catch (error) {
      logger.error('Error fetching location:', error);
      throw error;
    }
  },

  async updateLocation(userId: string, locationId: string, data: UpdateLocationData) {
    try {
      logger.info('Updating location', { userId, locationId });
      
      const location = await prisma.location.findFirst({
        where: {
          id: locationId,
          userId,
        },
      });

      if (!location) {
        throw new Error('Location not found');
      }

      const updatedLocation = await prisma.location.update({
        where: {
          id: locationId,
        },
        data,
      });

      logger.info('Location updated successfully', { locationId });
      return updatedLocation;
    } catch (error) {
      logger.error('Error updating location:', error);
      throw error;
    }
  },

  async deleteLocation(userId: string, locationId: string) {
    try {
      logger.info('Deleting location', { userId, locationId });
      
      const location = await prisma.location.findFirst({
        where: {
          id: locationId,
          userId,
        },
      });

      if (!location) {
        throw new Error('Location not found');
      }

      // Check if location has any stock
      const stockCount = await prisma.productStock.count({
        where: {
          locationId,
          quantity: {
            gt: 0,
          },
        },
      });

      if (stockCount > 0) {
        throw new Error('Cannot delete location with existing stock. Please transfer stock first.');
      }

      // Soft delete by setting isActive to false
      const deletedLocation = await prisma.location.update({
        where: {
          id: locationId,
        },
        data: {
          isActive: false,
        },
      });

      logger.info('Location deleted successfully', { locationId });
      return deletedLocation;
    } catch (error) {
      logger.error('Error deleting location:', error);
      throw error;
    }
  },

  async getLocationStock(userId: string, locationId: string) {
    try {
      logger.info('Fetching location stock', { userId, locationId });
      
      const location = await prisma.location.findFirst({
        where: {
          id: locationId,
          userId,
        },
      });

      if (!location) {
        throw new Error('Location not found');
      }

      const stock = await prisma.productStock.findMany({
        where: {
          locationId,
        },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              price: true,
              cost: true,
              minQuantity: true,
              imageUrl: true,
              category: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: {
          product: {
            name: 'asc',
          },
        },
      });

      logger.info('Location stock fetched successfully', { locationId, stockCount: stock.length });
      return stock;
    } catch (error) {
      logger.error('Error fetching location stock:', error);
      throw error;
    }
  },
}; 