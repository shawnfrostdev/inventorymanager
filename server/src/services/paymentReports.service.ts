import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export interface ReportDateRange {
  startDate: Date;
  endDate: Date;
}

export interface PaymentSummary {
  totalPayments: number;
  totalAmount: number;
  averagePayment: number;
  paymentsByMethod: Array<{
    method: string;
    count: number;
    amount: number;
    percentage: number;
  }>;
}

export const paymentReportsService = {
  // Generate comprehensive payment summary report
  async generatePaymentSummary(userId: string, dateRange?: ReportDateRange) {
    try {
      logger.info('Generating payment summary report', { userId, dateRange });

      const where: any = { userId };
      
      if (dateRange) {
        where.paymentDate = {
          gte: dateRange.startDate,
          lte: dateRange.endDate,
        };
      }

      // Get payment totals
      const [totalStats, paymentsByMethod] = await Promise.all([
        prisma.payment.aggregate({
          where,
          _count: { id: true },
          _sum: { amount: true },
          _avg: { amount: true },
        }),
        prisma.payment.groupBy({
          by: ['method'],
          where,
          _count: { id: true },
          _sum: { amount: true },
        }),
      ]);

      const totalAmount = totalStats._sum.amount || 0;
      const totalCount = totalStats._count.id || 0;

      // Calculate percentages for payment methods
      const paymentMethodStats = paymentsByMethod.map(method => ({
        method: method.method,
        count: method._count.id,
        amount: method._sum.amount || 0,
        percentage: totalAmount > 0 ? ((method._sum.amount || 0) / totalAmount) * 100 : 0,
      }));

      const summary: PaymentSummary = {
        totalPayments: totalCount,
        totalAmount,
        averagePayment: totalStats._avg.amount || 0,
        paymentsByMethod: paymentMethodStats,
      };

      logger.info('Payment summary generated successfully', summary);
      return summary;
    } catch (error) {
      logger.error('Error generating payment summary:', error);
      throw error;
    }
  },

  // Generate invoice aging report
  async generateInvoiceAgingReport(userId: string) {
    try {
      logger.info('Generating invoice aging report', { userId });

      const today = new Date();
      const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sixtyDaysAgo = new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000);
      const ninetyDaysAgo = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);

      const [current, thirtyDays, sixtyDays, ninetyDays, overNinety] = await Promise.all([
        // Current (not overdue)
        prisma.invoice.aggregate({
          where: {
            userId,
            status: { not: 'PAID' },
            dueDate: { gte: today },
          },
          _count: { id: true },
          _sum: { balanceAmount: true },
        }),
        // 1-30 days overdue
        prisma.invoice.aggregate({
          where: {
            userId,
            status: { not: 'PAID' },
            dueDate: { gte: thirtyDaysAgo, lt: today },
          },
          _count: { id: true },
          _sum: { balanceAmount: true },
        }),
        // 31-60 days overdue
        prisma.invoice.aggregate({
          where: {
            userId,
            status: { not: 'PAID' },
            dueDate: { gte: sixtyDaysAgo, lt: thirtyDaysAgo },
          },
          _count: { id: true },
          _sum: { balanceAmount: true },
        }),
        // 61-90 days overdue
        prisma.invoice.aggregate({
          where: {
            userId,
            status: { not: 'PAID' },
            dueDate: { gte: ninetyDaysAgo, lt: sixtyDaysAgo },
          },
          _count: { id: true },
          _sum: { balanceAmount: true },
        }),
        // Over 90 days overdue
        prisma.invoice.aggregate({
          where: {
            userId,
            status: { not: 'PAID' },
            dueDate: { lt: ninetyDaysAgo },
          },
          _count: { id: true },
          _sum: { balanceAmount: true },
        }),
      ]);

      const agingReport = {
        current: {
          count: current._count.id,
          amount: current._sum.balanceAmount || 0,
        },
        thirtyDays: {
          count: thirtyDays._count.id,
          amount: thirtyDays._sum.balanceAmount || 0,
        },
        sixtyDays: {
          count: sixtyDays._count.id,
          amount: sixtyDays._sum.balanceAmount || 0,
        },
        ninetyDays: {
          count: ninetyDays._count.id,
          amount: ninetyDays._sum.balanceAmount || 0,
        },
        overNinety: {
          count: overNinety._count.id,
          amount: overNinety._sum.balanceAmount || 0,
        },
      };

      logger.info('Invoice aging report generated successfully', agingReport);
      return agingReport;
    } catch (error) {
      logger.error('Error generating invoice aging report:', error);
      throw error;
    }
  },

  // Generate customer payment behavior report
  async generateCustomerPaymentReport(userId: string, limit: number = 20) {
    try {
      logger.info('Generating customer payment report', { userId, limit });

      const customerStats = await prisma.customer.findMany({
        where: {
          invoices: {
            some: {
              userId,
            },
          },
        },
        include: {
          invoices: {
            where: { userId },
            include: {
              payments: true,
            },
          },
          _count: {
            select: {
              invoices: {
                where: { userId },
              },
            },
          },
        },
        take: limit,
      });

      const customerReport = customerStats.map(customer => {
        const invoices = customer.invoices;
        const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.total, 0);
        const totalPaid = invoices.reduce((sum, inv) => sum + inv.paidAmount, 0);
        const totalOverdue = invoices
          .filter(inv => inv.status !== 'PAID' && new Date(inv.dueDate) < new Date())
          .reduce((sum, inv) => sum + inv.balanceAmount, 0);

        // Calculate average days to pay
        const paidInvoices = invoices.filter(inv => inv.status === 'PAID');
        const avgDaysToPay = paidInvoices.length > 0
          ? paidInvoices.reduce((sum, inv) => {
              const dueDate = new Date(inv.dueDate);
              const paidDate = inv.payments.length > 0 
                ? new Date(Math.max(...inv.payments.map(p => new Date(p.paymentDate).getTime())))
                : dueDate;
              return sum + Math.max(0, (paidDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
            }, 0) / paidInvoices.length
          : 0;

        return {
          customerId: customer.id,
          customerName: customer.name,
          customerEmail: customer.email,
          totalInvoices: customer._count.invoices,
          totalInvoiced,
          totalPaid,
          totalOutstanding: totalInvoiced - totalPaid,
          totalOverdue,
          paymentRate: totalInvoiced > 0 ? (totalPaid / totalInvoiced) * 100 : 0,
          averageDaysToPay: Math.round(avgDaysToPay),
        };
      });

      // Sort by total invoiced amount (descending)
      customerReport.sort((a, b) => b.totalInvoiced - a.totalInvoiced);

      logger.info('Customer payment report generated successfully', { 
        customerCount: customerReport.length 
      });
      return customerReport;
    } catch (error) {
      logger.error('Error generating customer payment report:', error);
      throw error;
    }
  },

  // Generate monthly revenue report
  async generateMonthlyRevenueReport(userId: string, year: number) {
    try {
      logger.info('Generating monthly revenue report', { userId, year });

      const monthlyData = await Promise.all(
        Array.from({ length: 12 }, async (_, month) => {
          const startDate = new Date(year, month, 1);
          const endDate = new Date(year, month + 1, 0, 23, 59, 59);

          const [invoiceStats, paymentStats] = await Promise.all([
            prisma.invoice.aggregate({
              where: {
                userId,
                invoiceDate: {
                  gte: startDate,
                  lte: endDate,
                },
              },
              _count: { id: true },
              _sum: { total: true },
            }),
            prisma.payment.aggregate({
              where: {
                userId,
                paymentDate: {
                  gte: startDate,
                  lte: endDate,
                },
              },
              _count: { id: true },
              _sum: { amount: true },
            }),
          ]);

          return {
            month: month + 1,
            monthName: startDate.toLocaleString('default', { month: 'long' }),
            invoicesIssued: invoiceStats._count.id,
            invoiceAmount: invoiceStats._sum.total || 0,
            paymentsReceived: paymentStats._count.id,
            paymentAmount: paymentStats._sum.amount || 0,
          };
        })
      );

      const yearSummary = {
        totalInvoices: monthlyData.reduce((sum, month) => sum + month.invoicesIssued, 0),
        totalInvoiceAmount: monthlyData.reduce((sum, month) => sum + month.invoiceAmount, 0),
        totalPayments: monthlyData.reduce((sum, month) => sum + month.paymentsReceived, 0),
        totalPaymentAmount: monthlyData.reduce((sum, month) => sum + month.paymentAmount, 0),
      };

      logger.info('Monthly revenue report generated successfully', { year, yearSummary });
      return {
        year,
        monthlyData,
        yearSummary,
      };
    } catch (error) {
      logger.error('Error generating monthly revenue report:', error);
      throw error;
    }
  },

  // Generate payment performance metrics
  async generatePaymentMetrics(userId: string, dateRange?: ReportDateRange) {
    try {
      logger.info('Generating payment performance metrics', { userId, dateRange });

      const where: any = { userId };
      const invoiceWhere: any = { userId };

      if (dateRange) {
        where.paymentDate = {
          gte: dateRange.startDate,
          lte: dateRange.endDate,
        };
        invoiceWhere.invoiceDate = {
          gte: dateRange.startDate,
          lte: dateRange.endDate,
        };
      }

      const [
        paymentStats,
        invoiceStats,
        overdueStats,
        avgDaysToPay,
      ] = await Promise.all([
        // Payment statistics
        prisma.payment.aggregate({
          where,
          _count: { id: true },
          _sum: { amount: true },
          _avg: { amount: true },
        }),
        // Invoice statistics
        prisma.invoice.aggregate({
          where: invoiceWhere,
          _count: { id: true },
          _sum: { total: true },
        }),
        // Overdue statistics
        prisma.invoice.aggregate({
          where: {
            ...invoiceWhere,
            status: { not: 'PAID' },
            dueDate: { lt: new Date() },
          },
          _count: { id: true },
          _sum: { balanceAmount: true },
        }),
        // Average days to pay (complex calculation)
        this.calculateAverageDaysToPay(userId, dateRange),
      ]);

      const metrics = {
        paymentMetrics: {
          totalPayments: paymentStats._count.id,
          totalAmountPaid: paymentStats._sum.amount || 0,
          averagePaymentAmount: paymentStats._avg.amount || 0,
        },
        invoiceMetrics: {
          totalInvoices: invoiceStats._count.id,
          totalAmountInvoiced: invoiceStats._sum.total || 0,
          collectionRate: invoiceStats._sum.total > 0 
            ? ((paymentStats._sum.amount || 0) / invoiceStats._sum.total) * 100 
            : 0,
        },
        overdueMetrics: {
          overdueInvoices: overdueStats._count.id,
          overdueAmount: overdueStats._sum.balanceAmount || 0,
          overdueRate: invoiceStats._count.id > 0 
            ? (overdueStats._count.id / invoiceStats._count.id) * 100 
            : 0,
        },
        performanceMetrics: {
          averageDaysToPay: avgDaysToPay,
          onTimePaymentRate: 100 - (overdueStats._count.id > 0 
            ? (overdueStats._count.id / invoiceStats._count.id) * 100 
            : 0),
        },
      };

      logger.info('Payment performance metrics generated successfully', metrics);
      return metrics;
    } catch (error) {
      logger.error('Error generating payment performance metrics:', error);
      throw error;
    }
  },

  // Helper function to calculate average days to pay
  async calculateAverageDaysToPay(userId: string, dateRange?: ReportDateRange) {
    try {
      const where: any = { 
        userId, 
        status: 'PAID',
      };

      if (dateRange) {
        where.invoiceDate = {
          gte: dateRange.startDate,
          lte: dateRange.endDate,
        };
      }

      const paidInvoices = await prisma.invoice.findMany({
        where,
        include: {
          payments: {
            orderBy: {
              paymentDate: 'desc',
            },
          },
        },
      });

      if (paidInvoices.length === 0) return 0;

      const totalDays = paidInvoices.reduce((sum, invoice) => {
        const dueDate = new Date(invoice.dueDate);
        const lastPayment = invoice.payments[0];
        
        if (!lastPayment) return sum;
        
        const paymentDate = new Date(lastPayment.paymentDate);
        const daysDifference = (paymentDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24);
        
        return sum + Math.max(0, daysDifference);
      }, 0);

      return Math.round(totalDays / paidInvoices.length);
    } catch (error) {
      logger.error('Error calculating average days to pay:', error);
      return 0;
    }
  },

  // Export report data to CSV format
  exportToCSV(data: any[], filename: string) {
    try {
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error('No data to export');
      }

      const headers = Object.keys(data[0]);
      const csvContent = [
        headers.join(','),
        ...data.map(row => 
          headers.map(header => {
            const value = row[header];
            // Handle values that might contain commas or quotes
            if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
          }).join(',')
        )
      ].join('\n');

      return {
        filename: `${filename}_${new Date().toISOString().split('T')[0]}.csv`,
        content: csvContent,
        contentType: 'text/csv',
      };
    } catch (error) {
      logger.error('Error exporting to CSV:', error);
      throw error;
    }
  },

  // Generate comprehensive financial dashboard data
  async generateFinancialDashboard(userId: string) {
    try {
      logger.info('Generating financial dashboard data', { userId });

      const [
        paymentSummary,
        agingReport,
        monthlyRevenue,
        performanceMetrics,
      ] = await Promise.all([
        this.generatePaymentSummary(userId),
        this.generateInvoiceAgingReport(userId),
        this.generateMonthlyRevenueReport(userId, new Date().getFullYear()),
        this.generatePaymentMetrics(userId),
      ]);

      const dashboard = {
        paymentSummary,
        agingReport,
        monthlyRevenue,
        performanceMetrics,
        generatedAt: new Date(),
      };

      logger.info('Financial dashboard generated successfully');
      return dashboard;
    } catch (error) {
      logger.error('Error generating financial dashboard:', error);
      throw error;
    }
  },
}; 