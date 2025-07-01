import { PrismaClient } from '@prisma/client';
import { AppError } from '../utils/error';
import {
  CreateCustomerRequest,
  UpdateCustomerRequest,
  CreateOrderRequest,
  UpdateOrderRequest,
  OrderQueryParams,
  CustomerQueryParams,
  OrderStatus,
  PaymentStatus,
} from '../types/order.types';
import { socketService } from './socket.service';

const prisma = new PrismaClient();

export class OrderService {
  // Customer methods
  static async createCustomer(data: CreateCustomerRequest, userId: string) {
    try {
      // Check if customer with email already exists
      const existingCustomer = await prisma.customer.findUnique({
        where: { email: data.email },
      });

      if (existingCustomer) {
        throw new AppError(400, 'Customer with this email already exists');
      }

      const customer = await prisma.customer.create({
        data: {
          ...data,
          balance: 0,
        },
        include: {
          _count: {
            select: { orders: true },
          },
        },
      });

      return customer;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(500, 'Failed to create customer');
    }
  }

  static async getCustomers(params: CustomerQueryParams) {
    try {
      const {
        page = 1,
        limit = 10,
        search,
        isActive,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = params;

      const skip = (page - 1) * limit;

      // Build where clause
      const where: any = {};
      
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
        ];
      }

      if (isActive !== undefined) {
        where.isActive = isActive;
      }

      // Get customers with pagination
      const [customers, total] = await Promise.all([
        prisma.customer.findMany({
          where,
          skip,
          take: limit,
          orderBy: { [sortBy]: sortOrder },
          include: {
            _count: {
              select: { orders: true },
            },
          },
        }),
        prisma.customer.count({ where }),
      ]);

      return {
        customers,
        pagination: {
          total,
          pages: Math.ceil(total / limit),
          page,
          limit,
        },
      };
    } catch (error) {
      throw new AppError(500, 'Failed to fetch customers');
    }
  }

  static async getCustomerById(id: string) {
    try {
      const customer = await prisma.customer.findUnique({
        where: { id },
        include: {
          _count: {
            select: { orders: true },
          },
          orders: {
            take: 5,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              orderNumber: true,
              status: true,
              total: true,
              orderDate: true,
            },
          },
        },
      });

      if (!customer) {
        throw new AppError(404, 'Customer not found');
      }

      return customer;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(500, 'Failed to fetch customer');
    }
  }

  static async updateCustomer(id: string, data: UpdateCustomerRequest) {
    try {
      // Check if customer exists
      const existingCustomer = await prisma.customer.findUnique({
        where: { id },
      });

      if (!existingCustomer) {
        throw new AppError(404, 'Customer not found');
      }

      // Check email uniqueness if email is being updated
      if (data.email && data.email !== existingCustomer.email) {
        const emailExists = await prisma.customer.findUnique({
          where: { email: data.email },
        });

        if (emailExists) {
          throw new AppError(400, 'Customer with this email already exists');
        }
      }

      const customer = await prisma.customer.update({
        where: { id },
        data,
        include: {
          _count: {
            select: { orders: true },
          },
        },
      });

      return customer;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(500, 'Failed to update customer');
    }
  }

  static async deleteCustomer(id: string) {
    try {
      // Check if customer exists
      const customer = await prisma.customer.findUnique({
        where: { id },
        include: {
          _count: {
            select: { orders: true },
          },
        },
      });

      if (!customer) {
        throw new AppError(404, 'Customer not found');
      }

      // Check if customer has orders
      if (customer._count.orders > 0) {
        throw new AppError(400, 'Cannot delete customer with existing orders. Deactivate instead.');
      }

      await prisma.customer.delete({
        where: { id },
      });

      return { message: 'Customer deleted successfully' };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(500, 'Failed to delete customer');
    }
  }

  // Order methods
  static async createOrder(data: CreateOrderRequest, userId: string) {
    try {
      // Generate order number
      const orderNumber = await this.generateOrderNumber();

      // Verify customer exists
      const customer = await prisma.customer.findUnique({
        where: { id: data.customerId },
      });

      if (!customer) {
        throw new AppError(404, 'Customer not found');
      }

      // Verify all products exist and calculate totals
      let subtotal = 0;
      const orderItemsWithTotals = [];

      for (const item of data.orderItems) {
        const product = await prisma.product.findUnique({
          where: { id: item.productId },
        });

        if (!product) {
          throw new AppError(404, `Product with ID ${item.productId} not found`);
        }

        // Check stock availability
        if (product.quantity < item.quantity) {
          throw new AppError(400, `Insufficient stock for product ${product.name}. Available: ${product.quantity}, Requested: ${item.quantity}`);
        }

        const itemTotal = (item.unitPrice * item.quantity) - (item.discount || 0);
        subtotal += itemTotal;

        orderItemsWithTotals.push({
          ...item,
          total: itemTotal,
        });
      }

      // Calculate total
      const total = subtotal + (data.taxAmount || 0) + (data.shippingAmount || 0) - (data.discountAmount || 0);

      // Create order with transaction
      const order = await prisma.$transaction(async (tx) => {
        // Create the order
        const newOrder = await tx.order.create({
          data: {
            orderNumber,
            status: OrderStatus.PENDING,
            paymentStatus: PaymentStatus.PENDING,
            subtotal,
            taxAmount: data.taxAmount || 0,
            discountAmount: data.discountAmount || 0,
            shippingAmount: data.shippingAmount || 0,
            total,
            notes: data.notes,
            shippingAddress: data.shippingAddress,
            billingAddress: data.billingAddress,
            customerId: data.customerId,
            userId,
            dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
          },
        });

        // Create order items
        for (const item of orderItemsWithTotals) {
          await tx.orderItem.create({
            data: {
              orderId: newOrder.id,
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discount: item.discount || 0,
              total: item.total,
            },
          });

          // Reduce product quantity
          await tx.product.update({
            where: { id: item.productId },
            data: {
              quantity: {
                decrement: item.quantity,
              },
            },
          });

          // Create stock movement
          await tx.stockMovement.create({
            data: {
              type: 'OUT',
              quantity: item.quantity,
              reason: `Order ${orderNumber}`,
              productId: item.productId,
              userId,
            },
          });
        }

        return newOrder;
      });

      // Get full order details for response and notification
      const fullOrder = await this.getOrderById(order.id);

      // Emit real-time order notification
      socketService.emitOrderNotification({
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerId: customer.id,
        customerName: customer.name,
        status: order.status,
        total: order.total,
        currency: 'USD', // You can make this configurable
        action: 'created',
        updatedBy: userId,
        timestamp: new Date(),
      });

      return fullOrder;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(500, 'Failed to create order');
    }
  }

  static async getOrders(params: OrderQueryParams) {
    try {
      const {
        page = 1,
        limit = 10,
        status,
        paymentStatus,
        customerId,
        search,
        sortBy = 'orderDate',
        sortOrder = 'desc',
        dateFrom,
        dateTo,
      } = params;

      const skip = (page - 1) * limit;

      // Build where clause
      const where: any = {};

      if (status) where.status = status;
      if (paymentStatus) where.paymentStatus = paymentStatus;
      if (customerId) where.customerId = customerId;

      if (search) {
        where.OR = [
          { orderNumber: { contains: search, mode: 'insensitive' } },
          { customer: { name: { contains: search, mode: 'insensitive' } } },
          { customer: { email: { contains: search, mode: 'insensitive' } } },
        ];
      }

      if (dateFrom || dateTo) {
        where.orderDate = {};
        if (dateFrom) where.orderDate.gte = new Date(dateFrom);
        if (dateTo) where.orderDate.lte = new Date(dateTo);
      }

      // Get orders with pagination
      const [orders, total] = await Promise.all([
        prisma.order.findMany({
          where,
          skip,
          take: limit,
          orderBy: { [sortBy]: sortOrder },
          include: {
            customer: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            createdBy: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            orderItems: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    sku: true,
                    price: true,
                  },
                },
              },
            },
          },
        }),
        prisma.order.count({ where }),
      ]);

      return {
        orders,
        pagination: {
          total,
          pages: Math.ceil(total / limit),
          page,
          limit,
        },
      };
    } catch (error) {
      throw new AppError(500, 'Failed to fetch orders');
    }
  }

  static async getOrderById(id: string) {
    try {
      const order = await prisma.order.findUnique({
        where: { id },
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          orderItems: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                  price: true,
                },
              },
            },
          },
        },
      });

      if (!order) {
        throw new AppError(404, 'Order not found');
      }

      return order;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(500, 'Failed to fetch order');
    }
  }

  static async updateOrder(id: string, data: UpdateOrderRequest) {
    try {
      const existingOrder = await prisma.order.findUnique({
        where: { id },
      });

      if (!existingOrder) {
        throw new AppError(404, 'Order not found');
      }

      // Handle status-specific logic
      if (data.status && data.status !== existingOrder.status) {
        await this.handleStatusChange(id, existingOrder.status, data.status);
      }

      const order = await prisma.order.update({
        where: { id },
        data: {
          ...data,
          dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
          shippedDate: data.shippedDate ? new Date(data.shippedDate) : undefined,
          deliveredDate: data.deliveredDate ? new Date(data.deliveredDate) : undefined,
        },
      });

      // Get updated order with full details
      const updatedOrder = await this.getOrderById(order.id);

      // Emit real-time order update notification
      socketService.emitOrderNotification({
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerId: updatedOrder.customer.id,
        customerName: updatedOrder.customer.name,
        status: order.status,
        total: order.total,
        currency: 'USD',
        action: 'updated',
        updatedBy: data.userId || 'system', // You might need to pass userId to this method
        timestamp: new Date(),
      });

      return updatedOrder;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(500, 'Failed to update order');
    }
  }

  static async deleteOrder(id: string) {
    try {
      const order = await prisma.order.findUnique({
        where: { id },
        include: {
          orderItems: true,
        },
      });

      if (!order) {
        throw new AppError(404, 'Order not found');
      }

      // Only allow deletion of pending orders
      if (order.status !== OrderStatus.PENDING) {
        throw new AppError(400, 'Only pending orders can be deleted');
      }

      // Restore product quantities and delete in transaction
      await prisma.$transaction(async (tx) => {
        // Restore product quantities
        for (const item of order.orderItems) {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              quantity: {
                increment: item.quantity,
              },
            },
          });
        }

        // Delete order (cascade will delete order items)
        await tx.order.delete({
          where: { id },
        });
      });

      return { message: 'Order deleted successfully' };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(500, 'Failed to delete order');
    }
  }

  // Helper methods
  private static async generateOrderNumber(): Promise<string> {
    const today = new Date();
    const year = today.getFullYear().toString().slice(-2);
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const day = today.getDate().toString().padStart(2, '0');

    // Get count of orders today
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    const orderCount = await prisma.order.count({
      where: {
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    const sequence = (orderCount + 1).toString().padStart(3, '0');
    return `ORD${year}${month}${day}${sequence}`;
  }

  private static async handleStatusChange(orderId: string, oldStatus: string, newStatus: string) {
    // Add any status-specific logic here
    // For example, when status changes to SHIPPED, set shippedDate
    if (newStatus === OrderStatus.SHIPPED) {
      await prisma.order.update({
        where: { id: orderId },
        data: { shippedDate: new Date() },
      });
    }

    if (newStatus === OrderStatus.DELIVERED) {
      await prisma.order.update({
        where: { id: orderId },
        data: { 
          deliveredDate: new Date(),
          shippedDate: new Date(), // Ensure shipped date is set if not already
        },
      });
    }
  }

  // Analytics methods
  static async getOrderStats() {
    try {
      const [
        totalOrders,
        totalRevenue,
        pendingOrders,
        shippedOrders,
        recentOrders,
      ] = await Promise.all([
        prisma.order.count(),
        prisma.order.aggregate({
          _sum: { total: true },
        }),
        prisma.order.count({
          where: { status: OrderStatus.PENDING },
        }),
        prisma.order.count({
          where: { status: OrderStatus.SHIPPED },
        }),
        prisma.order.findMany({
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: {
            customer: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        }),
      ]);

      return {
        totalOrders,
        totalRevenue: totalRevenue._sum.total || 0,
        pendingOrders,
        shippedOrders,
        recentOrders,
      };
    } catch (error) {
      throw new AppError(500, 'Failed to fetch order statistics');
    }
  }
} 