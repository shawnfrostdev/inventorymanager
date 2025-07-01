import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { sendEmail } from '../utils/email';

const prisma = new PrismaClient();

export interface ReminderSettings {
  daysBeforeDue: number[];
  daysAfterDue: number[];
  maxReminders: number;
  enabled: boolean;
}

export const paymentReminderService = {
  // Default reminder settings
  defaultSettings: {
    daysBeforeDue: [7, 3, 1], // Send reminders 7, 3, and 1 days before due date
    daysAfterDue: [1, 7, 14, 30], // Send reminders 1, 7, 14, and 30 days after due date
    maxReminders: 5,
    enabled: true,
  } as ReminderSettings,

  // Check for invoices that need reminders
  async checkAndSendReminders(userId?: string) {
    try {
      logger.info('Checking for invoices that need payment reminders', { userId });

      const where: any = {
        status: {
          not: 'PAID',
        },
      };

      if (userId) {
        where.userId = userId;
      }

      // Get all unpaid invoices
      const unpaidInvoices = await prisma.invoice.findMany({
        where,
        include: {
          customer: true,
          createdBy: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      });

      const remindersToSend = [];
      const today = new Date();

      for (const invoice of unpaidInvoices) {
        const dueDate = new Date(invoice.dueDate);
        const daysDifference = Math.floor((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        // Check if reminder is needed
        const reminderNeeded = this.shouldSendReminder(daysDifference, invoice);
        
        if (reminderNeeded) {
          remindersToSend.push({
            invoice,
            type: daysDifference >= 0 ? 'before_due' : 'overdue',
            daysDifference: Math.abs(daysDifference),
          });
        }
      }

      // Send reminders
      const results = await Promise.allSettled(
        remindersToSend.map(reminder => this.sendPaymentReminder(reminder))
      );

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      logger.info('Payment reminders processing completed', {
        total: remindersToSend.length,
        successful,
        failed,
      });

      return {
        total: remindersToSend.length,
        successful,
        failed,
        reminders: remindersToSend,
      };
    } catch (error) {
      logger.error('Error checking and sending payment reminders:', error);
      throw error;
    }
  },

  // Determine if a reminder should be sent
  shouldSendReminder(daysDifference: number, invoice: any): boolean {
    const settings = this.defaultSettings;

    if (!settings.enabled) {
      return false;
    }

    // Check if it's a "before due" reminder
    if (daysDifference > 0) {
      return settings.daysBeforeDue.includes(daysDifference);
    }
    
    // Check if it's an "overdue" reminder
    if (daysDifference <= 0) {
      const daysOverdue = Math.abs(daysDifference);
      return settings.daysAfterDue.includes(daysOverdue);
    }

    return false;
  },

  // Send a payment reminder email
  async sendPaymentReminder(reminderData: any) {
    try {
      const { invoice, type, daysDifference } = reminderData;

      logger.info('Sending payment reminder', {
        invoiceId: invoice.id,
        customerId: invoice.customer.id,
        type,
        daysDifference,
      });

      const subject = this.generateReminderSubject(type, daysDifference, invoice.invoiceNumber);
      const emailBody = this.generateReminderEmail(type, daysDifference, invoice);

      await sendEmail({
        to: invoice.customer.email,
        subject,
        html: emailBody,
        // CC the business owner if needed
        cc: process.env.BUSINESS_EMAIL || invoice.createdBy.email,
      });

      // Log the reminder in database (you could create a reminders table)
      logger.info('Payment reminder sent successfully', {
        invoiceId: invoice.id,
        customerEmail: invoice.customer.email,
        type,
      });

      return {
        success: true,
        invoiceId: invoice.id,
        customerEmail: invoice.customer.email,
      };
    } catch (error) {
      logger.error('Error sending payment reminder:', error);
      throw error;
    }
  },

  // Generate reminder email subject
  generateReminderSubject(type: string, daysDifference: number, invoiceNumber: string): string {
    if (type === 'before_due') {
      if (daysDifference === 1) {
        return `Payment Due Tomorrow - Invoice ${invoiceNumber}`;
      }
      return `Payment Due in ${daysDifference} Days - Invoice ${invoiceNumber}`;
    } else {
      if (daysDifference === 1) {
        return `Payment Overdue - Invoice ${invoiceNumber}`;
      }
      return `Payment ${daysDifference} Days Overdue - Invoice ${invoiceNumber}`;
    }
  },

  // Generate reminder email body
  generateReminderEmail(type: string, daysDifference: number, invoice: any): string {
    const dueDate = new Date(invoice.dueDate).toLocaleDateString();
    const amount = `$${invoice.total.toFixed(2)} ${invoice.currency}`;
    
    let urgencyMessage = '';
    let actionMessage = '';
    
    if (type === 'before_due') {
      urgencyMessage = daysDifference === 1 
        ? 'This is a friendly reminder that your payment is due tomorrow.'
        : `This is a friendly reminder that your payment is due in ${daysDifference} days.`;
      actionMessage = 'Please ensure payment is made by the due date to avoid any late fees.';
    } else {
      urgencyMessage = daysDifference === 1
        ? 'Your payment is now 1 day overdue.'
        : `Your payment is now ${daysDifference} days overdue.`;
      actionMessage = 'Please make payment immediately to avoid additional charges or service interruption.';
    }

    return `
      <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
            <h2 style="color: #333; margin-bottom: 20px;">Payment Reminder</h2>
            
            <p>Dear ${invoice.customer.name},</p>
            
            <p>${urgencyMessage}</p>
            
            <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #007bff;">Invoice Details</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; font-weight: bold;">Invoice Number:</td>
                  <td style="padding: 8px 0;">${invoice.invoiceNumber}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold;">Amount Due:</td>
                  <td style="padding: 8px 0; font-size: 18px; color: #dc3545;">${amount}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold;">Due Date:</td>
                  <td style="padding: 8px 0;">${dueDate}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold;">Balance Remaining:</td>
                  <td style="padding: 8px 0;">$${invoice.balanceAmount.toFixed(2)} ${invoice.currency}</td>
                </tr>
              </table>
            </div>
            
            <p>${actionMessage}</p>
            
            <div style="margin: 30px 0;">
              <h4>Payment Options:</h4>
              <ul>
                <li>Online payment portal: <a href="${process.env.CLIENT_URL}/pay/${invoice.id}">Pay Now</a></li>
                <li>Bank transfer: Please reference invoice number ${invoice.invoiceNumber}</li>
                <li>Check payment: Made payable to your business</li>
              </ul>
            </div>
            
            ${invoice.notes ? `<p><strong>Notes:</strong> ${invoice.notes}</p>` : ''}
            
            <p>If you have any questions or need assistance, please don't hesitate to contact us.</p>
            
            <p>Thank you for your business!</p>
            
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
            <p style="font-size: 12px; color: #666;">
              This is an automated reminder. If you have already made this payment, please disregard this message.
            </p>
          </div>
        </body>
      </html>
    `;
  },

  // Send manual reminder for specific invoice
  async sendManualReminder(userId: string, invoiceId: string, customMessage?: string) {
    try {
      logger.info('Sending manual payment reminder', { userId, invoiceId });

      const invoice = await prisma.invoice.findFirst({
        where: {
          id: invoiceId,
          userId,
        },
        include: {
          customer: true,
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

      if (invoice.status === 'PAID') {
        throw new Error('Cannot send reminder for paid invoice');
      }

      const today = new Date();
      const dueDate = new Date(invoice.dueDate);
      const daysDifference = Math.floor((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      const type = daysDifference >= 0 ? 'before_due' : 'overdue';

      const result = await this.sendPaymentReminder({
        invoice,
        type,
        daysDifference: Math.abs(daysDifference),
        customMessage,
      });

      return result;
    } catch (error) {
      logger.error('Error sending manual reminder:', error);
      throw error;
    }
  },

  // Get reminder statistics
  async getReminderStats(userId: string) {
    try {
      logger.info('Fetching reminder statistics', { userId });

      const [overdueInvoices, dueSoonInvoices, totalUnpaid] = await Promise.all([
        // Overdue invoices
        prisma.invoice.count({
          where: {
            userId,
            status: { not: 'PAID' },
            dueDate: { lt: new Date() },
          },
        }),
        // Due in next 7 days
        prisma.invoice.count({
          where: {
            userId,
            status: { not: 'PAID' },
            dueDate: {
              gte: new Date(),
              lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
          },
        }),
        // Total unpaid amount
        prisma.invoice.aggregate({
          where: {
            userId,
            status: { not: 'PAID' },
          },
          _sum: { balanceAmount: true },
        }),
      ]);

      const stats = {
        overdueInvoices,
        dueSoonInvoices,
        totalUnpaidAmount: totalUnpaid._sum.balanceAmount || 0,
      };

      logger.info('Reminder statistics fetched successfully', stats);
      return stats;
    } catch (error) {
      logger.error('Error fetching reminder statistics:', error);
      throw error;
    }
  },
}; 