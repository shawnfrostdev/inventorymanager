import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export interface TransferStockData {
  productId: string;
  fromLocationId: string;
  toLocationId: string;
  quantity: number;
  reason?: string;
}

export const transferService = {
  async transferStock(userId: string, data: TransferStockData) {
    const { productId, fromLocationId, toLocationId, quantity, reason } = data;

    if (quantity <= 0) {
      throw new Error('Transfer quantity must be greater than 0');
    }

    if (fromLocationId === toLocationId) {
      throw new Error('Cannot transfer stock to the same location');
    }

    try {
      logger.info('Starting stock transfer', {
        userId,
        productId,
        fromLocationId,
        toLocationId,
        quantity,
      });

      // Start transaction
      const result = await prisma.$transaction(async (tx) => {
        // Verify locations exist and belong to user
        const [fromLocation, toLocation] = await Promise.all([
          tx.location.findFirst({
            where: { id: fromLocationId, userId, isActive: true },
          }),
          tx.location.findFirst({
            where: { id: toLocationId, userId, isActive: true },
          }),
        ]);

        if (!fromLocation) {
          throw new Error('Source location not found');
        }

        if (!toLocation) {
          throw new Error('Destination location not found');
        }

        // Verify product exists and belongs to user
        const product = await tx.product.findFirst({
          where: { id: productId, userId },
        });

        if (!product) {
          throw new Error('Product not found');
        }

        // Check current stock at source location
        const fromStock = await tx.productStock.findUnique({
          where: {
            productId_locationId: {
              productId,
              locationId: fromLocationId,
            },
          },
        });

        if (!fromStock || fromStock.quantity < quantity) {
          throw new Error(`Insufficient stock at source location. Available: ${fromStock?.quantity || 0}, Required: ${quantity}`);
        }

        // Get or create stock record at destination location
        const toStock = await tx.productStock.upsert({
          where: {
            productId_locationId: {
              productId,
              locationId: toLocationId,
            },
          },
          create: {
            productId,
            locationId: toLocationId,
            quantity: 0,
          },
          update: {},
        });

        // Update stock quantities
        const [updatedFromStock, updatedToStock] = await Promise.all([
          tx.productStock.update({
            where: {
              productId_locationId: {
                productId,
                locationId: fromLocationId,
              },
            },
            data: {
              quantity: fromStock.quantity - quantity,
            },
          }),
          tx.productStock.update({
            where: {
              productId_locationId: {
                productId,
                locationId: toLocationId,
              },
            },
            data: {
              quantity: toStock.quantity + quantity,
            },
          }),
        ]);

        // Create stock movement record
        const stockMovement = await tx.stockMovement.create({
          data: {
            type: 'TRANSFER',
            quantity,
            reason: reason || `Transfer from ${fromLocation.name} to ${toLocation.name}`,
            productId,
            fromLocationId,
            toLocationId,
            userId,
          },
        });

        logger.info('Stock transfer completed successfully', {
          transferId: stockMovement.id,
          fromStockAfter: updatedFromStock.quantity,
          toStockAfter: updatedToStock.quantity,
        });

        return {
          transfer: stockMovement,
          fromStock: updatedFromStock,
          toStock: updatedToStock,
        };
      });

      return result;
    } catch (error) {
      logger.error('Error during stock transfer:', error);
      throw error;
    }
  },

  async getTransferHistory(userId: string, options: {
    productId?: string;
    locationId?: string;
    limit?: number;
    offset?: number;
  } = {}) {
    try {
      const { productId, locationId, limit = 50, offset = 0 } = options;

      logger.info('Fetching transfer history', { userId, options });

      const where: any = {
        userId,
        type: 'TRANSFER',
      };

      if (productId) {
        where.productId = productId;
      }

      if (locationId) {
        where.OR = [
          { fromLocationId: locationId },
          { toLocationId: locationId },
        ];
      }

      const [transfers, total] = await Promise.all([
        prisma.stockMovement.findMany({
          where,
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                imageUrl: true,
              },
            },
            fromLocation: {
              select: {
                id: true,
                name: true,
              },
            },
            toLocation: {
              select: {
                id: true,
                name: true,
              },
            },
            createdBy: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: limit,
          skip: offset,
        }),
        prisma.stockMovement.count({
          where,
        }),
      ]);

      logger.info('Transfer history fetched successfully', {
        count: transfers.length,
        total,
      });

      return {
        transfers,
        total,
        limit,
        offset,
      };
    } catch (error) {
      logger.error('Error fetching transfer history:', error);
      throw error;
    }
  },

  async getTransferById(userId: string, transferId: string) {
    try {
      logger.info('Fetching transfer by ID', { userId, transferId });

      const transfer = await prisma.stockMovement.findFirst({
        where: {
          id: transferId,
          userId,
          type: 'TRANSFER',
        },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              imageUrl: true,
              category: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          fromLocation: {
            select: {
              id: true,
              name: true,
              address: true,
            },
          },
          toLocation: {
            select: {
              id: true,
              name: true,
              address: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      if (!transfer) {
        throw new Error('Transfer not found');
      }

      logger.info('Transfer found successfully', { transferId });
      return transfer;
    } catch (error) {
      logger.error('Error fetching transfer:', error);
      throw error;
    }
  },

  async getLocationStockLevel(userId: string, productId: string, locationId: string) {
    try {
      logger.info('Fetching stock level for product at location', {
        userId,
        productId,
        locationId,
      });

      const stock = await prisma.productStock.findUnique({
        where: {
          productId_locationId: {
            productId,
            locationId,
          },
        },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              minQuantity: true,
            },
          },
          location: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      return stock || { quantity: 0 };
    } catch (error) {
      logger.error('Error fetching stock level:', error);
      throw error;
    }
  },
}; 