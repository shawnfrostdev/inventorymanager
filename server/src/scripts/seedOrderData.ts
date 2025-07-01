import { PrismaClient } from '@prisma/client';
import { OrderStatus, PaymentStatus } from '../types/order.types';

const prisma = new PrismaClient();

async function main() {
  console.log('🛒 Seeding order system data...');

  try {
    // Create sample customers
    const customers = [
      {
        name: 'John Doe',
        email: 'john.doe@example.com',
        phone: '+1-555-0101',
        address: '123 Main St',
        city: 'New York',
        state: 'NY',
        zipCode: '10001',
        country: 'USA',
        creditLimit: 5000.00,
      },
      {
        name: 'Sarah Smith',
        email: 'sarah.smith@example.com',
        phone: '+1-555-0102',
        address: '456 Oak Avenue',
        city: 'Los Angeles',
        state: 'CA',
        zipCode: '90210',
        country: 'USA',
        creditLimit: 10000.00,
      },
      {
        name: 'Tech Solutions Inc',
        email: 'orders@techsolutions.com',
        phone: '+1-555-0103',
        address: '789 Business Blvd',
        city: 'Chicago',
        state: 'IL',
        zipCode: '60601',
        country: 'USA',
        creditLimit: 25000.00,
      },
      {
        name: 'Emma Wilson',
        email: 'emma.wilson@gmail.com',
        phone: '+1-555-0104',
        address: '321 Pine Street',
        city: 'Seattle',
        state: 'WA',
        zipCode: '98101',
        country: 'USA',
        creditLimit: 3000.00,
      },
    ];

    const createdCustomers = [];
    for (const customerData of customers) {
      try {
        const customer = await prisma.customer.create({
          data: customerData,
        });
        createdCustomers.push(customer);
        console.log(`✅ Customer created: ${customer.name}`);
      } catch (error: any) {
        if (error.code === 'P2002') {
          console.log(`⚠️ Customer already exists: ${customerData.email}`);
          const existingCustomer = await prisma.customer.findUnique({
            where: { email: customerData.email },
          });
          if (existingCustomer) {
            createdCustomers.push(existingCustomer);
          }
        } else {
          throw error;
        }
      }
    }

    // Get admin user and products for creating orders
    const adminUser = await prisma.user.findUnique({
      where: { email: 'admin@inventory.com' },
    });

    if (!adminUser) {
      throw new Error('Admin user not found. Please run createAdminUser.ts first.');
    }

    const products = await prisma.product.findMany();
    if (products.length === 0) {
      throw new Error('No products found. Please run seedDatabase.ts first.');
    }

    // Create sample orders
    const orderData = [
      {
        customerId: createdCustomers[0].id,
        items: [
          { productId: products[0].id, quantity: 2, unitPrice: products[0].price, discount: 0 },
          { productId: products[1].id, quantity: 1, unitPrice: products[1].price, discount: 0 },
        ],
        status: OrderStatus.DELIVERED,
        paymentStatus: PaymentStatus.PAID,
        shippingAddress: `${createdCustomers[0].address}, ${createdCustomers[0].city}, ${createdCustomers[0].state} ${createdCustomers[0].zipCode}`,
        taxAmount: 50.00,
        shippingAmount: 15.00,
      },
      {
        customerId: createdCustomers[1].id,
        items: [
          { productId: products[2].id, quantity: 3, unitPrice: products[2].price, discount: 0 },
        ],
        status: OrderStatus.SHIPPED,
        paymentStatus: PaymentStatus.PAID,
        shippingAddress: `${createdCustomers[1].address}, ${createdCustomers[1].city}, ${createdCustomers[1].state} ${createdCustomers[1].zipCode}`,
        taxAmount: 8.50,
        shippingAmount: 12.00,
      },
      {
        customerId: createdCustomers[2].id,
        items: [
          { productId: products[0].id, quantity: 5, unitPrice: products[0].price, discount: 100.00 },
          { productId: products[3].id, quantity: 2, unitPrice: products[3].price, discount: 0 },
          { productId: products[4].id, quantity: 1, unitPrice: products[4].price, discount: 0 },
        ],
        status: OrderStatus.PROCESSING,
        paymentStatus: PaymentStatus.PARTIAL,
        shippingAddress: `${createdCustomers[2].address}, ${createdCustomers[2].city}, ${createdCustomers[2].state} ${createdCustomers[2].zipCode}`,
        taxAmount: 150.00,
        shippingAmount: 25.00,
        discountAmount: 200.00,
      },
      {
        customerId: createdCustomers[3].id,
        items: [
          { productId: products[1].id, quantity: 1, unitPrice: products[1].price, discount: 0 },
        ],
        status: OrderStatus.PENDING,
        paymentStatus: PaymentStatus.PENDING,
        shippingAddress: `${createdCustomers[3].address}, ${createdCustomers[3].city}, ${createdCustomers[3].state} ${createdCustomers[3].zipCode}`,
        taxAmount: 12.99,
        shippingAmount: 9.99,
      },
    ];

    let orderCount = 0;
    for (const order of orderData) {
      try {
        // Generate order number
        const today = new Date();
        const year = today.getFullYear().toString().slice(-2);
        const month = (today.getMonth() + 1).toString().padStart(2, '0');
        const day = today.getDate().toString().padStart(2, '0');
        const sequence = (orderCount + 1).toString().padStart(3, '0');
        const orderNumber = `ORD${year}${month}${day}${sequence}`;

        // Calculate totals
        let subtotal = 0;
        for (const item of order.items) {
          subtotal += (item.unitPrice * item.quantity) - item.discount;
        }

        const total = subtotal + order.taxAmount + order.shippingAmount - (order.discountAmount || 0);

        // Create order in transaction
        await prisma.$transaction(async (tx) => {
          const newOrder = await tx.order.create({
            data: {
              orderNumber,
              status: order.status,
              paymentStatus: order.paymentStatus,
              subtotal,
              taxAmount: order.taxAmount,
              discountAmount: order.discountAmount || 0,
              shippingAmount: order.shippingAmount,
              total,
              shippingAddress: order.shippingAddress,
              customerId: order.customerId,
              userId: adminUser.id,
              shippedDate: order.status === OrderStatus.SHIPPED || order.status === OrderStatus.DELIVERED ? new Date() : undefined,
              deliveredDate: order.status === OrderStatus.DELIVERED ? new Date() : undefined,
            },
          });

          // Create order items
          for (const item of order.items) {
            const itemTotal = (item.unitPrice * item.quantity) - item.discount;
            
            await tx.orderItem.create({
              data: {
                orderId: newOrder.id,
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                discount: item.discount,
                total: itemTotal,
              },
            });

            // Only update stock for non-pending orders (simulate processing)
            if (order.status !== OrderStatus.PENDING) {
              await tx.product.update({
                where: { id: item.productId },
                data: {
                  quantity: {
                    decrement: item.quantity,
                  },
                },
              });

              await tx.stockMovement.create({
                data: {
                  type: 'OUT',
                  quantity: item.quantity,
                  reason: `Order ${orderNumber}`,
                  productId: item.productId,
                  userId: adminUser.id,
                },
              });
            }
          }
        });

        console.log(`✅ Order created: ${orderNumber} (${order.status})`);
        orderCount++;
      } catch (error) {
        console.error(`❌ Error creating order:`, error);
      }
    }

    console.log(`\n🎉 Order system seeding completed!`);
    console.log(`✅ Customers: ${createdCustomers.length}`);
    console.log(`✅ Orders: ${orderCount}`);
    
    // Display summary stats
    const stats = await prisma.order.aggregate({
      _count: true,
      _sum: { total: true },
    });

    console.log(`\n📊 Order System Summary:`);
    console.log(`Total Orders: ${stats._count}`);
    console.log(`Total Revenue: $${(stats._sum.total || 0).toFixed(2)}`);

  } catch (error) {
    console.error('❌ Error seeding order data:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 