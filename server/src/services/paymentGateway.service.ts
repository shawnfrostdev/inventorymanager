import Stripe from 'stripe';
import { logger } from '../utils/logger';

// Initialize Stripe (in production, use environment variable)
const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' })
  : null;

export interface CreatePaymentIntentData {
  amount: number; // Amount in cents
  currency: string;
  customerId?: string;
  description?: string;
  metadata?: Record<string, string>;
}

export interface ProcessPaymentData {
  paymentMethodId: string;
  amount: number;
  currency: string;
  customerId?: string;
  description?: string;
}

export const paymentGatewayService = {
  // Create a payment intent for card payments
  async createPaymentIntent(data: CreatePaymentIntentData) {
    try {
      if (!stripe) {
        throw new Error('Stripe not configured. Please set STRIPE_SECRET_KEY environment variable.');
      }

      logger.info('Creating Stripe payment intent', { 
        amount: data.amount, 
        currency: data.currency 
      });

      const paymentIntent = await stripe.paymentIntents.create({
        amount: data.amount,
        currency: data.currency.toLowerCase(),
        customer: data.customerId,
        description: data.description,
        metadata: data.metadata || {},
        automatic_payment_methods: {
          enabled: true,
        },
      });

      logger.info('Payment intent created successfully', { 
        paymentIntentId: paymentIntent.id 
      });

      return {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: paymentIntent.status,
      };
    } catch (error) {
      logger.error('Error creating payment intent:', error);
      throw error;
    }
  },

  // Create a Stripe customer
  async createCustomer(email: string, name: string, metadata?: Record<string, string>) {
    try {
      if (!stripe) {
        throw new Error('Stripe not configured.');
      }

      logger.info('Creating Stripe customer', { email, name });

      const customer = await stripe.customers.create({
        email,
        name,
        metadata: metadata || {},
      });

      logger.info('Stripe customer created successfully', { customerId: customer.id });
      return customer;
    } catch (error) {
      logger.error('Error creating Stripe customer:', error);
      throw error;
    }
  },

  // Process a direct payment (for saved payment methods)
  async processPayment(data: ProcessPaymentData) {
    try {
      if (!stripe) {
        throw new Error('Stripe not configured.');
      }

      logger.info('Processing direct payment', { 
        paymentMethodId: data.paymentMethodId,
        amount: data.amount 
      });

      const paymentIntent = await stripe.paymentIntents.create({
        amount: data.amount,
        currency: data.currency.toLowerCase(),
        customer: data.customerId,
        payment_method: data.paymentMethodId,
        description: data.description,
        confirm: true,
        return_url: `${process.env.CLIENT_URL}/dashboard/invoices`,
      });

      logger.info('Payment processed successfully', { 
        paymentIntentId: paymentIntent.id,
        status: paymentIntent.status 
      });

      return {
        paymentIntentId: paymentIntent.id,
        status: paymentIntent.status,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
      };
    } catch (error) {
      logger.error('Error processing payment:', error);
      throw error;
    }
  },

  // Verify webhook signature (for webhook endpoints)
  verifyWebhookSignature(payload: string, signature: string): Stripe.Event | null {
    try {
      if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
        throw new Error('Stripe webhook not configured.');
      }

      const event = stripe.webhooks.constructEvent(
        payload,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );

      return event;
    } catch (error) {
      logger.error('Error verifying webhook signature:', error);
      return null;
    }
  },

  // Handle payment success webhook
  async handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent) {
    try {
      logger.info('Handling payment success webhook', { 
        paymentIntentId: paymentIntent.id 
      });

      // Here you would update your database
      // For example, mark invoice as paid, create payment record, etc.
      
      return {
        success: true,
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
      };
    } catch (error) {
      logger.error('Error handling payment success:', error);
      throw error;
    }
  },

  // Get payment status
  async getPaymentStatus(paymentIntentId: string) {
    try {
      if (!stripe) {
        throw new Error('Stripe not configured.');
      }

      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      
      return {
        id: paymentIntent.id,
        status: paymentIntent.status,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        created: paymentIntent.created,
      };
    } catch (error) {
      logger.error('Error getting payment status:', error);
      throw error;
    }
  },

  // Create a refund
  async createRefund(paymentIntentId: string, amount?: number, reason?: string) {
    try {
      if (!stripe) {
        throw new Error('Stripe not configured.');
      }

      logger.info('Creating refund', { paymentIntentId, amount, reason });

      const refund = await stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: amount, // If not provided, refunds the full amount
        reason: reason as Stripe.RefundCreateParams.Reason,
      });

      logger.info('Refund created successfully', { refundId: refund.id });
      return refund;
    } catch (error) {
      logger.error('Error creating refund:', error);
      throw error;
    }
  },

  // Convert amount to cents (Stripe uses cents)
  convertToCents(amount: number): number {
    return Math.round(amount * 100);
  },

  // Convert from cents to dollars
  convertFromCents(amountInCents: number): number {
    return amountInCents / 100;
  },
}; 