import { PrismaClient } from '@prisma/client';
import { beforeAll, afterAll } from '@jest/globals';

// Test database instance
export const testDb = new PrismaClient({
  datasources: {
    db: {
      url: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL
    }
  }
});

// Global test setup
beforeAll(async () => {
  // Connect to test database
  await testDb.$connect();
  
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-jwt-secret-key';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key';
});

// Global test teardown
afterAll(async () => {
  await testDb.$disconnect();
});

// Simple cleanup function that won't hang
export const cleanupDatabase = async () => {
  try {
    // Delete in order to respect foreign key constraints
    await testDb.stockMovement.deleteMany({});
    await testDb.orderItem.deleteMany({});
    await testDb.order.deleteMany({});
    await testDb.product.deleteMany({});
    await testDb.category.deleteMany({});
    await testDb.customer.deleteMany({});
    await testDb.user.deleteMany({});
  } catch (error) {
    console.warn('Database cleanup warning:', error);
  }
};

// Test utilities
export const createTestUser = async (overrides = {}) => {
  const bcrypt = require('bcryptjs');
  
  return await testDb.user.create({
    data: {
      email: `test-${Date.now()}@example.com`,
      name: 'Test User',
      password: await bcrypt.hash('password123', 12),
      role: 'USER',
      isEmailVerified: true,
      ...overrides
    }
  });
};

export const createTestProduct = async (userId: string, overrides = {}) => {
  // First create a category
  const category = await testDb.category.create({
    data: {
      name: `Test Category ${Date.now()}`,
      description: 'Test category description'
    }
  });

  return await testDb.product.create({
    data: {
      name: `Test Product ${Date.now()}`,
      description: 'Test product description',
      sku: `TEST-${Date.now()}`,
      price: 100,
      cost: 50,
      quantity: 10,
      minQuantity: 5,
      categoryId: category.id,
      userId,
      ...overrides
    }
  });
};

export const createTestCustomer = async (overrides = {}) => {
  return await testDb.customer.create({
    data: {
      name: 'Test Customer',
      email: `test-customer-${Date.now()}@example.com`,
      phone: '+1234567890',
      address: '123 Test St',
      city: 'Test City',
      state: 'Test State',
      zipCode: '12345',
      country: 'Test Country',
      ...overrides
    }
  });
};

export const createTestOrder = async (userId: string, customerId: string, overrides = {}) => {
  return await testDb.order.create({
    data: {
      orderNumber: `ORD-${Date.now()}`,
      status: 'PENDING',
      paymentStatus: 'PENDING',
      subtotal: 100,
      taxAmount: 10,
      total: 110,
      userId,
      customerId,
      ...overrides
    }
  });
}; 