import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { socketService } from './socket.service';

const prisma = new PrismaClient();

export interface CreateInvoiceData {
  customerId: string;
  orderId?: string;
  currency?: string;
  dueDate: Date;
  notes?: string;
  termsAndConditions?: string;
  items: {
    productId?: string;
    description: string;
    quantity: number;
    unitPrice: number;
    discount?: number;
    taxRate?: number;
  }[];
}

export interface CreatePaymentData {
  invoiceId: string;
  amount: number;
  method: string;
  reference?: string;
  notes?: string;
  paymentDate?: Date;
}

export const invoiceService = {
  async createInvoice(userId: string, data: CreateInvoiceData) {
    try {
      logger.info('Creating new invoice', { userId, customerId: data.customerId });

      const result = await prisma.$transaction(async (tx) => {
        // Verify customer exists
        const customer = await tx.customer.findFirst({
          where: { id: data.customerId },
        });

        if (!customer) {
          throw new Error('Customer not found');
        }

        // Generate invoice number
        const year = new Date().getFullYear();
        const month = String(new Date().getMonth() + 1).padStart(2, '0');
        const count = await tx.invoice.count({
          where: {
            userId,
            invoiceDate: {
              gte: new Date(year, new Date().getMonth(), 1),
            },
          },
        });
        const invoiceNumber = `INV${year}${month}${String(count + 1).padStart(4, '0')}`;

        // Calculate totals
        let subtotal = 0;
        let totalTax = 0;
        let totalDiscount = 0;

        const calculatedItems = data.items.map((item) => {
          const itemSubtotal = item.quantity * item.unitPrice;
          const itemDiscount = (item.discount || 0) / 100 * itemSubtotal;
          const itemTaxableAmount = itemSubtotal - itemDiscount;
          const itemTax = (item.taxRate || 0) / 100 * itemTaxableAmount;
          const itemTotal = itemTaxableAmount + itemTax;

          subtotal += itemSubtotal;
          totalDiscount += itemDiscount;
          totalTax += itemTax;

          return {
            ...item,
            total: itemTotal,
          };
        });

        const total = subtotal - totalDiscount + totalTax;

        // Create invoice
        const invoice = await tx.invoice.create({
          data: {
            invoiceNumber,
            customerId: data.customerId,
            orderId: data.orderId,
            currency: data.currency || 'USD',
            subtotal,
            taxAmount: totalTax,
            discountAmount: totalDiscount,
            total,
            balanceAmount: total,
            dueDate: data.dueDate,
            notes: data.notes,
            termsAndConditions: data.termsAndConditions,
            userId,
          },
        });

        // Create invoice items
        const invoiceItems = await Promise.all(
          calculatedItems.map((item) =>
            tx.invoiceItem.create({
              data: {
                invoiceId: invoice.id,
                productId: item.productId,
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                discount: item.discount || 0,
                taxRate: item.taxRate || 0,
                total: item.total,
              },
            })
          )
        );

        return { invoice, invoiceItems };
      });

      // Get customer data for notification
      const customer = await prisma.customer.findUnique({
        where: { id: data.customerId },
      });

      // Emit real-time invoice notification
      if (customer) {
        socketService.emitInvoiceNotification({
          invoiceId: result.invoice.id,
          invoiceNumber: result.invoice.invoiceNumber,
          customerId: customer.id,
          customerName: customer.name,
          status: result.invoice.status,
          total: result.invoice.total,
          currency: result.invoice.currency,
          action: 'created',
          updatedBy: userId,
          timestamp: new Date(),
        });
      }

      logger.info('Invoice created successfully', { invoiceId: result.invoice.id });
      return result;
    } catch (error) {
      logger.error('Error creating invoice:', error);
      throw error;
    }
  },

  async getInvoices(userId: string, options: {
    customerId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  } = {}) {
    try {
      const { customerId, status, limit = 50, offset = 0 } = options;

      logger.info('Fetching invoices', { userId, options });

      const where: any = { userId };
      if (customerId) where.customerId = customerId;
      if (status) where.status = status;

      const [invoices, total] = await Promise.all([
        prisma.invoice.findMany({
          where,
          include: {
            customer: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            order: {
              select: {
                id: true,
                orderNumber: true,
              },
            },
            _count: {
              select: {
                invoiceItems: true,
                payments: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: limit,
          skip: offset,
        }),
        prisma.invoice.count({ where }),
      ]);

      logger.info('Invoices fetched successfully', { count: invoices.length, total });
      return { invoices, total, limit, offset };
    } catch (error) {
      logger.error('Error fetching invoices:', error);
      throw error;
    }
  },

  async getInvoiceById(userId: string, invoiceId: string) {
    try {
      logger.info('Fetching invoice by ID', { userId, invoiceId });

      const invoice = await prisma.invoice.findFirst({
        where: {
          id: invoiceId,
          userId,
        },
        include: {
          customer: true,
          order: {
            include: {
              orderItems: {
                include: {
                  product: {
                    select: {
                      name: true,
                      sku: true,
                    },
                  },
                },
              },
            },
          },
          invoiceItems: {
            include: {
              product: {
                select: {
                  name: true,
                  sku: true,
                },
              },
            },
          },
          payments: {
            orderBy: {
              createdAt: 'desc',
            },
          },
          createdBy: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      });

      if (!invoice) {
        throw new Error('Invoice not found');
      }

      logger.info('Invoice found successfully', { invoiceId });
      return invoice;
    } catch (error) {
      logger.error('Error fetching invoice:', error);
      throw error;
    }
  },

  async updateInvoiceStatus(userId: string, invoiceId: string, status: string) {
    try {
      logger.info('Updating invoice status', { userId, invoiceId, status });

      const invoice = await prisma.invoice.findFirst({
        where: {
          id: invoiceId,
          userId,
        },
      });

      if (!invoice) {
        throw new Error('Invoice not found');
      }

      const updatedInvoice = await prisma.invoice.update({
        where: { id: invoiceId },
        data: { status },
      });

      logger.info('Invoice status updated successfully', { invoiceId, status });
      return updatedInvoice;
    } catch (error) {
      logger.error('Error updating invoice status:', error);
      throw error;
    }
  },

  async createPayment(userId: string, data: CreatePaymentData) {
    try {
      logger.info('Creating payment', { userId, invoiceId: data.invoiceId });

      const result = await prisma.$transaction(async (tx) => {
        // Get invoice
        const invoice = await tx.invoice.findFirst({
          where: {
            id: data.invoiceId,
            userId,
          },
        });

        if (!invoice) {
          throw new Error('Invoice not found');
        }

        if (data.amount <= 0) {
          throw new Error('Payment amount must be greater than 0');
        }

        if (data.amount > invoice.balanceAmount) {
          throw new Error('Payment amount cannot exceed balance amount');
        }

        // Generate payment number
        const year = new Date().getFullYear();
        const month = String(new Date().getMonth() + 1).padStart(2, '0');
        const count = await tx.payment.count({
          where: {
            userId,
            paymentDate: {
              gte: new Date(year, new Date().getMonth(), 1),
            },
          },
        });
        const paymentNumber = `PAY${year}${month}${String(count + 1).padStart(4, '0')}`;

        // Create payment
        const payment = await tx.payment.create({
          data: {
            paymentNumber,
            invoiceId: data.invoiceId,
            amount: data.amount,
            currency: invoice.currency,
            method: data.method,
            reference: data.reference,
            notes: data.notes,
            paymentDate: data.paymentDate || new Date(),
            userId,
          },
        });

        // Update invoice amounts
        const newPaidAmount = invoice.paidAmount + data.amount;
        const newBalanceAmount = invoice.total - newPaidAmount;
        
        let newStatus = invoice.status;
        if (newBalanceAmount === 0) {
          newStatus = 'PAID';
        } else if (newPaidAmount > 0 && newBalanceAmount > 0) {
          newStatus = 'PARTIAL';
        }

        const updatedInvoice = await tx.invoice.update({
          where: { id: data.invoiceId },
          data: {
            paidAmount: newPaidAmount,
            balanceAmount: newBalanceAmount,
          },
        });

        return { payment, invoice: updatedInvoice };
      });

      // Get invoice and customer data for notification
      const invoiceWithCustomer = await prisma.invoice.findUnique({
        where: { id: data.invoiceId },
        include: {
          customer: true,
        },
      });

      // Emit real-time payment notification
      if (invoiceWithCustomer) {
        socketService.emitPaymentNotification({
          paymentId: result.payment.id,
          paymentNumber: result.payment.paymentNumber,
          invoiceId: invoiceWithCustomer.id,
          invoiceNumber: invoiceWithCustomer.invoiceNumber,
          amount: result.payment.amount,
          currency: result.payment.currency,
          method: result.payment.method,
          customerId: invoiceWithCustomer.customer.id,
          customerName: invoiceWithCustomer.customer.name,
          timestamp: new Date(),
        });

        // If invoice is fully paid, emit invoice status update
        if (result.invoice.balanceAmount === 0) {
          socketService.emitInvoiceNotification({
            invoiceId: invoiceWithCustomer.id,
            invoiceNumber: invoiceWithCustomer.invoiceNumber,
            customerId: invoiceWithCustomer.customer.id,
            customerName: invoiceWithCustomer.customer.name,
            status: 'PAID',
            total: invoiceWithCustomer.total,
            currency: invoiceWithCustomer.currency,
            action: 'paid',
            updatedBy: userId,
            timestamp: new Date(),
          });
        }
      }

      logger.info('Payment created successfully', { paymentId: result.payment.id });
      return result;
    } catch (error) {
      logger.error('Error creating payment:', error);
      throw error;
    }
  },

  async generateInvoiceFromOrder(userId: string, orderId: string, dueDate: Date) {
    try {
      logger.info('Generating invoice from order', { userId, orderId });

      const order = await prisma.order.findFirst({
        where: {
          id: orderId,
          userId,
        },
        include: {
          customer: true,
          orderItems: {
            include: {
              product: true,
            },
          },
        },
      });

      if (!order) {
        throw new Error('Order not found');
      }

      // Convert order items to invoice items
      const invoiceItems = order.orderItems.map((item) => ({
        productId: item.productId,
        description: item.product.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount,
        taxRate: 0, // You can calculate tax based on product/customer
      }));

      const invoiceData: CreateInvoiceData = {
        customerId: order.customerId,
        orderId: order.id,
        dueDate,
        items: invoiceItems,
        notes: `Invoice generated from order ${order.orderNumber}`,
      };

      const result = await this.createInvoice(userId, invoiceData);

      logger.info('Invoice generated from order successfully', {
        orderId,
        invoiceId: result.invoice.id,
      });

      return result;
    } catch (error) {
      logger.error('Error generating invoice from order:', error);
      throw error;
    }
  },

  async getInvoiceStats(userId: string) {
    try {
      logger.info('Fetching invoice statistics', { userId });

      const [
        totalInvoices,
        paidInvoices,
        overdueInvoices,
        totalRevenue,
        pendingAmount,
      ] = await Promise.all([
        prisma.invoice.count({ where: { userId } }),
        prisma.invoice.count({ where: { userId, status: 'PAID' } }),
        prisma.invoice.count({
          where: {
            userId,
            status: { not: 'PAID' },
            dueDate: { lt: new Date() },
          },
        }),
        prisma.invoice.aggregate({
          where: { userId, status: 'PAID' },
          _sum: { total: true },
        }),
        prisma.invoice.aggregate({
          where: { userId, status: { not: 'PAID' } },
          _sum: { balanceAmount: true },
        }),
      ]);

      const stats = {
        totalInvoices,
        paidInvoices,
        overdueInvoices,
        draftInvoices: totalInvoices - paidInvoices - overdueInvoices,
        totalRevenue: totalRevenue._sum.total || 0,
        pendingAmount: pendingAmount._sum.balanceAmount || 0,
      };

      logger.info('Invoice statistics fetched successfully', stats);
      return stats;
    } catch (error) {
      logger.error('Error fetching invoice statistics:', error);
      throw error;
    }
  },
}; 