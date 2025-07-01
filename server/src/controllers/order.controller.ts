import { Request, Response } from 'express';
import { OrderService } from '../services/order.service';
import { AppError } from '../utils/error';
import {
  createCustomerSchema,
  updateCustomerSchema,
  createOrderSchema,
  updateOrderSchema,
  CustomerQueryParams,
  OrderQueryParams,
} from '../types/order.types';
import logger from '../utils/logger';

export class OrderController {
  // Customer endpoints
  static async createCustomer(req: Request, res: Response) {
    try {
      const validatedData = createCustomerSchema.parse(req.body);
      const userId = req.user?.userId;

      if (!userId) {
        throw new AppError(401, 'User not authenticated');
      }

      const customer = await OrderService.createCustomer(validatedData, userId);

      logger.info(`Customer created: ${customer.email}`, {
        customerId: customer.id,
        userId,
      });

      res.status(201).json({
        status: 'success',
        data: { customer },
      });
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          status: 'error',
          message: error.message,
        });
      } else {
        logger.error('Error creating customer:', error);
        res.status(500).json({
          status: 'error',
          message: 'Internal server error',
        });
      }
    }
  }

  static async getCustomers(req: Request, res: Response) {
    try {
      const params: CustomerQueryParams = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 10,
        search: req.query.search as string,
        isActive: req.query.isActive ? req.query.isActive === 'true' : undefined,
        sortBy: req.query.sortBy as any,
        sortOrder: req.query.sortOrder as any,
      };

      const result = await OrderService.getCustomers(params);

      res.json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      logger.error('Error fetching customers:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch customers',
      });
    }
  }

  static async getCustomerById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const customer = await OrderService.getCustomerById(id);

      res.json({
        status: 'success',
        data: { customer },
      });
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          status: 'error',
          message: error.message,
        });
      } else {
        logger.error('Error fetching customer:', error);
        res.status(500).json({
          status: 'error',
          message: 'Internal server error',
        });
      }
    }
  }

  static async updateCustomer(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const validatedData = updateCustomerSchema.parse(req.body);

      const customer = await OrderService.updateCustomer(id, validatedData);

      logger.info(`Customer updated: ${customer.email}`, {
        customerId: customer.id,
        userId: req.user?.userId,
      });

      res.json({
        status: 'success',
        data: { customer },
      });
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          status: 'error',
          message: error.message,
        });
      } else {
        logger.error('Error updating customer:', error);
        res.status(500).json({
          status: 'error',
          message: 'Internal server error',
        });
      }
    }
  }

  static async deleteCustomer(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const result = await OrderService.deleteCustomer(id);

      logger.info(`Customer deleted: ${id}`, {
        userId: req.user?.userId,
      });

      res.json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          status: 'error',
          message: error.message,
        });
      } else {
        logger.error('Error deleting customer:', error);
        res.status(500).json({
          status: 'error',
          message: 'Internal server error',
        });
      }
    }
  }

  // Order endpoints
  static async createOrder(req: Request, res: Response) {
    try {
      const validatedData = createOrderSchema.parse(req.body);
      const userId = req.user?.userId;

      if (!userId) {
        throw new AppError(401, 'User not authenticated');
      }

      const order = await OrderService.createOrder(validatedData, userId);

      logger.info(`Order created: ${order.orderNumber}`, {
        orderId: order.id,
        customerId: order.customer.id,
        total: order.total,
        userId,
      });

      res.status(201).json({
        status: 'success',
        data: { order },
      });
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          status: 'error',
          message: error.message,
        });
      } else {
        logger.error('Error creating order:', error);
        res.status(500).json({
          status: 'error',
          message: 'Internal server error',
        });
      }
    }
  }

  static async getOrders(req: Request, res: Response) {
    try {
      const params: OrderQueryParams = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 10,
        status: req.query.status as any,
        paymentStatus: req.query.paymentStatus as any,
        customerId: req.query.customerId as string,
        search: req.query.search as string,
        sortBy: req.query.sortBy as any,
        sortOrder: req.query.sortOrder as any,
        dateFrom: req.query.dateFrom as string,
        dateTo: req.query.dateTo as string,
      };

      const result = await OrderService.getOrders(params);

      res.json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      logger.error('Error fetching orders:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch orders',
      });
    }
  }

  static async getOrderById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const order = await OrderService.getOrderById(id);

      res.json({
        status: 'success',
        data: { order },
      });
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          status: 'error',
          message: error.message,
        });
      } else {
        logger.error('Error fetching order:', error);
        res.status(500).json({
          status: 'error',
          message: 'Internal server error',
        });
      }
    }
  }

  static async updateOrder(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const validatedData = updateOrderSchema.parse(req.body);

      const order = await OrderService.updateOrder(id, validatedData);

      logger.info(`Order updated: ${order.orderNumber}`, {
        orderId: order.id,
        status: order.status,
        userId: req.user?.userId,
      });

      res.json({
        status: 'success',
        data: { order },
      });
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          status: 'error',
          message: error.message,
        });
      } else {
        logger.error('Error updating order:', error);
        res.status(500).json({
          status: 'error',
          message: 'Internal server error',
        });
      }
    }
  }

  static async deleteOrder(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const result = await OrderService.deleteOrder(id);

      logger.info(`Order deleted: ${id}`, {
        userId: req.user?.userId,
      });

      res.json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          status: 'error',
          message: error.message,
        });
      } else {
        logger.error('Error deleting order:', error);
        res.status(500).json({
          status: 'error',
          message: 'Internal server error',
        });
      }
    }
  }

  // Analytics endpoints
  static async getOrderStats(req: Request, res: Response) {
    try {
      const stats = await OrderService.getOrderStats();

      res.json({
        status: 'success',
        data: { stats },
      });
    } catch (error) {
      logger.error('Error fetching order statistics:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch order statistics',
      });
    }
  }

  // Bulk operations
  static async bulkUpdateOrderStatus(req: Request, res: Response) {
    try {
      const { orderIds, status } = req.body;

      if (!Array.isArray(orderIds) || orderIds.length === 0) {
        throw new AppError(400, 'Order IDs are required');
      }

      if (!status) {
        throw new AppError(400, 'Status is required');
      }

      const results = await Promise.allSettled(
        orderIds.map((id) => OrderService.updateOrder(id, { status }))
      );

      const successful = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.filter((r) => r.status === 'rejected').length;

      logger.info(`Bulk order status update completed`, {
        successful,
        failed,
        status,
        userId: req.user?.userId,
      });

      res.json({
        status: 'success',
        data: {
          message: `Updated ${successful} orders successfully, ${failed} failed`,
          successful,
          failed,
        },
      });
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          status: 'error',
          message: error.message,
        });
      } else {
        logger.error('Error in bulk update:', error);
        res.status(500).json({
          status: 'error',
          message: 'Internal server error',
        });
      }
    }
  }

  // Order search suggestions
  static async getOrderSuggestions(req: Request, res: Response) {
    try {
      const { q } = req.query;

      if (!q || typeof q !== 'string') {
        return res.json({
          status: 'success',
          data: { suggestions: [] },
        });
      }

      const suggestions = await OrderService.getOrders({
        search: q,
        limit: 5,
      });

      res.json({
        status: 'success',
        data: {
          suggestions: suggestions.orders.map((order) => ({
            id: order.id,
            orderNumber: order.orderNumber,
            customerName: order.customer.name,
            total: order.total,
            status: order.status,
          })),
        },
      });
    } catch (error) {
      logger.error('Error fetching order suggestions:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch suggestions',
      });
    }
  }

  // Customer search suggestions
  static async getCustomerSuggestions(req: Request, res: Response) {
    try {
      const { q } = req.query;

      if (!q || typeof q !== 'string') {
        return res.json({
          status: 'success',
          data: { suggestions: [] },
        });
      }

      const suggestions = await OrderService.getCustomers({
        search: q,
        limit: 5,
        isActive: true,
      });

      res.json({
        status: 'success',
        data: {
          suggestions: suggestions.customers.map((customer) => ({
            id: customer.id,
            name: customer.name,
            email: customer.email,
            ordersCount: customer._count?.orders || 0,
          })),
        },
      });
    } catch (error) {
      logger.error('Error fetching customer suggestions:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch suggestions',
      });
    }
  }
} 