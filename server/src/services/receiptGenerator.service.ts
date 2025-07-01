import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { sendEmail } from '../utils/email';

const prisma = new PrismaClient();

export const receiptGeneratorService = {
  // Generate payment receipt HTML
  generateReceiptHTML(payment: any, invoice: any, customer: any, business: any) {
    const paymentDate = new Date(payment.paymentDate).toLocaleDateString();
    const invoiceDate = new Date(invoice.invoiceDate).toLocaleDateString();
    const dueDate = new Date(invoice.dueDate).toLocaleDateString();

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Payment Receipt - ${payment.paymentNumber}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              max-width: 800px;
              margin: 0 auto;
              padding: 20px;
              color: #333;
            }
            .header {
              border-bottom: 3px solid #007bff;
              padding-bottom: 20px;
              margin-bottom: 30px;
            }
            .company-info {
              text-align: right;
              margin-bottom: 20px;
            }
            .receipt-title {
              font-size: 24px;
              font-weight: bold;
              color: #007bff;
              margin-bottom: 10px;
            }
            .receipt-number {
              font-size: 16px;
              color: #666;
            }
            .customer-info {
              margin-bottom: 30px;
            }
            .info-section {
              margin-bottom: 20px;
            }
            .info-title {
              font-weight: bold;
              color: #333;
              margin-bottom: 10px;
              border-bottom: 1px solid #eee;
              padding-bottom: 5px;
            }
            .details-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
            }
            .details-table th,
            .details-table td {
              padding: 12px;
              text-align: left;
              border-bottom: 1px solid #eee;
            }
            .details-table th {
              background-color: #f8f9fa;
              font-weight: bold;
            }
            .amount-highlight {
              font-size: 18px;
              font-weight: bold;
              color: #28a745;
            }
            .payment-method {
              background-color: #e7f3ff;
              padding: 10px;
              border-radius: 5px;
              margin: 10px 0;
            }
            .footer {
              margin-top: 40px;
              padding-top: 20px;
              border-top: 1px solid #eee;
              text-align: center;
              color: #666;
              font-size: 12px;
            }
            .status-paid {
              background-color: #28a745;
              color: white;
              padding: 5px 10px;
              border-radius: 4px;
              font-size: 12px;
              text-transform: uppercase;
            }
            @media print {
              body { margin: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="company-info">
              <h2>${business.name || 'Your Business'}</h2>
              <p>${business.address || ''}</p>
              <p>${business.email || ''} | ${business.phone || ''}</p>
            </div>
            <div class="receipt-title">PAYMENT RECEIPT</div>
            <div class="receipt-number">Receipt #${payment.paymentNumber}</div>
          </div>

          <div class="customer-info">
            <div class="info-title">Bill To:</div>
            <p><strong>${customer.name}</strong></p>
            <p>${customer.email}</p>
            ${customer.address ? `<p>${customer.address}</p>` : ''}
            ${customer.phone ? `<p>Phone: ${customer.phone}</p>` : ''}
          </div>

          <div class="info-section">
            <div class="info-title">Payment Information</div>
            <table class="details-table">
              <tr>
                <th>Receipt Number</th>
                <td>${payment.paymentNumber}</td>
              </tr>
              <tr>
                <th>Payment Date</th>
                <td>${paymentDate}</td>
              </tr>
              <tr>
                <th>Payment Method</th>
                <td>
                  <div class="payment-method">
                    ${this.formatPaymentMethod(payment.method)}
                    ${payment.reference ? `<br>Reference: ${payment.reference}` : ''}
                  </div>
                </td>
              </tr>
              <tr>
                <th>Amount Paid</th>
                <td class="amount-highlight">$${payment.amount.toFixed(2)} ${payment.currency}</td>
              </tr>
              <tr>
                <th>Status</th>
                <td><span class="status-paid">Paid</span></td>
              </tr>
            </table>
          </div>

          <div class="info-section">
            <div class="info-title">Invoice Details</div>
            <table class="details-table">
              <tr>
                <th>Invoice Number</th>
                <td>${invoice.invoiceNumber}</td>
              </tr>
              <tr>
                <th>Invoice Date</th>
                <td>${invoiceDate}</td>
              </tr>
              <tr>
                <th>Due Date</th>
                <td>${dueDate}</td>
              </tr>
              <tr>
                <th>Invoice Total</th>
                <td>$${invoice.total.toFixed(2)} ${invoice.currency}</td>
              </tr>
              <tr>
                <th>Previous Payments</th>
                <td>$${(invoice.paidAmount - payment.amount).toFixed(2)} ${invoice.currency}</td>
              </tr>
              <tr>
                <th>This Payment</th>
                <td class="amount-highlight">$${payment.amount.toFixed(2)} ${payment.currency}</td>
              </tr>
              <tr>
                <th>Remaining Balance</th>
                <td>
                  ${invoice.balanceAmount > 0 
                    ? `$${invoice.balanceAmount.toFixed(2)} ${invoice.currency}` 
                    : '<span class="status-paid">PAID IN FULL</span>'
                  }
                </td>
              </tr>
            </table>
          </div>

          ${payment.notes ? `
            <div class="info-section">
              <div class="info-title">Payment Notes</div>
              <p>${payment.notes}</p>
            </div>
          ` : ''}

          <div class="footer">
            <p>Thank you for your payment!</p>
            <p>This is an official receipt for your records.</p>
            <p>Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
          </div>
        </body>
      </html>
    `;
  },

  // Format payment method for display
  formatPaymentMethod(method: string): string {
    const methodMap: { [key: string]: string } = {
      'CASH': 'Cash Payment',
      'CREDIT_CARD': 'Credit Card',
      'DEBIT_CARD': 'Debit Card',
      'BANK_TRANSFER': 'Bank Transfer',
      'CHECK': 'Check Payment',
      'PAYPAL': 'PayPal',
      'STRIPE': 'Credit Card (Stripe)',
      'OTHER': 'Other Payment Method',
    };
    return methodMap[method] || method;
  },

  // Generate and send receipt email
  async generateAndSendReceipt(userId: string, paymentId: string) {
    try {
      logger.info('Generating payment receipt', { userId, paymentId });

      // Get payment with related data
      const payment = await prisma.payment.findFirst({
        where: {
          id: paymentId,
          userId,
        },
        include: {
          invoice: {
            include: {
              customer: true,
              createdBy: {
                select: {
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
      });

      if (!payment) {
        throw new Error('Payment not found');
      }

      const { invoice } = payment;
      const customer = invoice.customer;

      // Business information (you could store this in database)
      const business = {
        name: process.env.BUSINESS_NAME || 'Your Business Name',
        address: process.env.BUSINESS_ADDRESS || '',
        email: process.env.BUSINESS_EMAIL || invoice.createdBy.email,
        phone: process.env.BUSINESS_PHONE || '',
      };

      // Generate receipt HTML
      const receiptHTML = this.generateReceiptHTML(payment, invoice, customer, business);

      // Send receipt email
      await sendEmail({
        to: customer.email,
        subject: `Payment Receipt - ${payment.paymentNumber}`,
        html: receiptHTML,
        // CC business owner
        cc: business.email,
      });

      logger.info('Payment receipt sent successfully', {
        paymentId,
        customerEmail: customer.email,
        receiptNumber: payment.paymentNumber,
      });

      return {
        success: true,
        receiptNumber: payment.paymentNumber,
        customerEmail: customer.email,
        receiptHTML, // Return HTML for preview if needed
      };
    } catch (error) {
      logger.error('Error generating and sending receipt:', error);
      throw error;
    }
  },

  // Generate receipt for viewing (without sending email)
  async generateReceiptForViewing(userId: string, paymentId: string) {
    try {
      logger.info('Generating receipt for viewing', { userId, paymentId });

      const payment = await prisma.payment.findFirst({
        where: {
          id: paymentId,
          userId,
        },
        include: {
          invoice: {
            include: {
              customer: true,
              createdBy: {
                select: {
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
      });

      if (!payment) {
        throw new Error('Payment not found');
      }

      const { invoice } = payment;
      const customer = invoice.customer;

      const business = {
        name: process.env.BUSINESS_NAME || 'Your Business Name',
        address: process.env.BUSINESS_ADDRESS || '',
        email: process.env.BUSINESS_EMAIL || invoice.createdBy.email,
        phone: process.env.BUSINESS_PHONE || '',
      };

      const receiptHTML = this.generateReceiptHTML(payment, invoice, customer, business);

      return {
        receiptHTML,
        receiptNumber: payment.paymentNumber,
        payment,
        invoice,
        customer,
      };
    } catch (error) {
      logger.error('Error generating receipt for viewing:', error);
      throw error;
    }
  },

  // Auto-generate receipt when payment is created
  async autoGenerateReceipt(payment: any) {
    try {
      logger.info('Auto-generating receipt for new payment', { paymentId: payment.id });

      // Auto-send receipt email for successful payments
      if (payment.status === 'PAID') {
        await this.generateAndSendReceipt(payment.userId, payment.id);
      }

      return { success: true };
    } catch (error) {
      logger.error('Error auto-generating receipt:', error);
      // Don't throw error for auto-generation to avoid breaking payment flow
      return { success: false, error: error.message };
    }
  },

  // Batch generate receipts for multiple payments
  async batchGenerateReceipts(userId: string, paymentIds: string[]) {
    try {
      logger.info('Batch generating receipts', { userId, count: paymentIds.length });

      const results = await Promise.allSettled(
        paymentIds.map(paymentId => this.generateAndSendReceipt(userId, paymentId))
      );

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      logger.info('Batch receipt generation completed', { successful, failed });

      return {
        total: paymentIds.length,
        successful,
        failed,
        results,
      };
    } catch (error) {
      logger.error('Error in batch receipt generation:', error);
      throw error;
    }
  },
}; 