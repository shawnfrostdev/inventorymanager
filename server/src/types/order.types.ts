import { z } from 'zod';

// Enums
export enum OrderStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  PROCESSING = 'PROCESSING',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
  RETURNED = 'RETURNED'
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PARTIAL = 'PARTIAL',
  PAID = 'PAID',
  REFUNDED = 'REFUNDED',
  FAILED = 'FAILED'
}

// Customer schemas
export const createCustomerSchema = z.object({
  name: z.string().min(1, 'Customer name is required'),
  email: z.string().email('Valid email is required'),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  country: z.string().optional(),
  taxId: z.string().optional(),
  creditLimit: z.number().optional(),
  notes: z.string().optional(),
});

export const updateCustomerSchema = createCustomerSchema.partial();

// Order item schema
export const orderItemSchema = z.object({
  productId: z.string().uuid('Valid product ID is required'),
  quantity: z.number().int().positive('Quantity must be positive'),
  unitPrice: z.number().positive('Unit price must be positive'),
  discount: z.number().min(0).optional().default(0),
});

// Order schemas
export const createOrderSchema = z.object({
  customerId: z.string().uuid('Valid customer ID is required'),
  orderItems: z.array(orderItemSchema).min(1, 'At least one order item is required'),
  notes: z.string().optional(),
  shippingAddress: z.string().optional(),
  billingAddress: z.string().optional(),
  taxAmount: z.number().min(0).optional().default(0),
  discountAmount: z.number().min(0).optional().default(0),
  shippingAmount: z.number().min(0).optional().default(0),
  dueDate: z.string().datetime().optional(),
});

export const updateOrderSchema = z.object({
  status: z.nativeEnum(OrderStatus).optional(),
  paymentStatus: z.nativeEnum(PaymentStatus).optional(),
  notes: z.string().optional(),
  shippingAddress: z.string().optional(),
  billingAddress: z.string().optional(),
  taxAmount: z.number().min(0).optional(),
  discountAmount: z.number().min(0).optional(),
  shippingAmount: z.number().min(0).optional(),
  dueDate: z.string().datetime().optional(),
  shippedDate: z.string().datetime().optional(),
  deliveredDate: z.string().datetime().optional(),
});

// Type exports
export type CreateCustomerRequest = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerRequest = z.infer<typeof updateCustomerSchema>;
export type CreateOrderRequest = z.infer<typeof createOrderSchema>;
export type UpdateOrderRequest = z.infer<typeof updateOrderSchema>;
export type OrderItemRequest = z.infer<typeof orderItemSchema>;

// Response types
export interface CustomerResponse {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  taxId?: string;
  creditLimit?: number;
  balance: number;
  notes?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  _count?: {
    orders: number;
  };
}

export interface OrderItemResponse {
  id: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
  product: {
    id: string;
    name: string;
    sku: string;
    price: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderResponse {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  shippingAmount: number;
  total: number;
  notes?: string;
  shippingAddress?: string;
  billingAddress?: string;
  orderDate: Date;
  dueDate?: Date;
  shippedDate?: Date;
  deliveredDate?: Date;
  customer: {
    id: string;
    name: string;
    email: string;
  };
  createdBy: {
    id: string;
    name: string;
    email: string;
  };
  orderItems: OrderItemResponse[];
  createdAt: Date;
  updatedAt: Date;
}

// Query parameters
export interface OrderQueryParams {
  page?: number;
  limit?: number;
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  customerId?: string;
  search?: string;
  sortBy?: 'orderDate' | 'total' | 'status' | 'orderNumber';
  sortOrder?: 'asc' | 'desc';
  dateFrom?: string;
  dateTo?: string;
}

export interface CustomerQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
  sortBy?: 'name' | 'email' | 'createdAt' | 'balance';
  sortOrder?: 'asc' | 'desc';
} 