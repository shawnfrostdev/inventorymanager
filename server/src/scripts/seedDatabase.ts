import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create categories
  const categories = await Promise.all([
    prisma.category.upsert({
      where: { name: 'Electronics' },
      update: {},
      create: {
        name: 'Electronics',
        description: 'Electronic devices and gadgets',
      },
    }),
    prisma.category.upsert({
      where: { name: 'Clothing' },
      update: {},
      create: {
        name: 'Clothing',
        description: 'Apparel and fashion items',
      },
    }),
    prisma.category.upsert({
      where: { name: 'Books' },
      update: {},
      create: {
        name: 'Books',
        description: 'Books and educational materials',
      },
    }),
    prisma.category.upsert({
      where: { name: 'Home & Garden' },
      update: {},
      create: {
        name: 'Home & Garden',
        description: 'Home improvement and garden supplies',
      },
    }),
  ]);

  console.log('✅ Categories created:', categories.length);

  // Find a user to assign products to (or create a default user)
  let user = await prisma.user.findFirst();
  
  if (!user) {
    // Create a default user if none exists
    const bcrypt = await import('bcryptjs');
    const hashedPassword = await bcrypt.hash('password123', 12);
    
    user = await prisma.user.create({
      data: {
        email: 'admin@inventory.com',
        password: hashedPassword,
        name: 'Admin User',
        role: 'ADMIN',
        isEmailVerified: true,
      },
    });
    console.log('✅ Default admin user created');
  }

  // Create sample products
  const products = [
    {
      name: 'iPhone 14 Pro',
      description: 'Latest iPhone with Pro features',
      sku: 'IPH14PRO001',
      barcode: '123456789012',
      price: 999.99,
      cost: 750.00,
      quantity: 25,
      minQuantity: 5,
      categoryId: categories[0].id,
    },
    {
      name: 'Samsung Galaxy S23',
      description: 'Samsung flagship smartphone',
      sku: 'SAM23001',
      barcode: '123456789013',
      price: 799.99,
      cost: 600.00,
      quantity: 15,
      minQuantity: 3,
      categoryId: categories[0].id,
    },
    {
      name: 'Nike Air Max',
      description: 'Comfortable running shoes',
      sku: 'NIKE001',
      barcode: '123456789014',
      price: 129.99,
      cost: 80.00,
      quantity: 50,
      minQuantity: 10,
      categoryId: categories[1].id,
    },
    {
      name: 'The Great Gatsby',
      description: 'Classic American novel',
      sku: 'BOOK001',
      barcode: '123456789015',
      price: 12.99,
      cost: 8.00,
      quantity: 100,
      minQuantity: 20,
      categoryId: categories[2].id,
    },
    {
      name: 'Garden Hose 50ft',
      description: 'Durable garden hose for watering',
      sku: 'HOSE001',
      barcode: '123456789016',
      price: 39.99,
      cost: 25.00,
      quantity: 30,
      minQuantity: 5,
      categoryId: categories[3].id,
    },
    {
      name: 'Wireless Headphones',
      description: 'Bluetooth noise-canceling headphones',
      sku: 'HEAD001',
      barcode: '123456789017',
      price: 199.99,
      cost: 120.00,
      quantity: 2, // Low stock to test alerts
      minQuantity: 5,
      categoryId: categories[0].id,
    },
  ];

  for (const productData of products) {
    await prisma.product.upsert({
      where: { sku: productData.sku },
      update: {},
      create: {
        ...productData,
        userId: user.id,
      },
    });
  }

  console.log('✅ Products created:', products.length);

  // Create some sample stock movements
  const productsInDb = await prisma.product.findMany();
  
  for (const product of productsInDb.slice(0, 3)) {
    await prisma.stockMovement.create({
      data: {
        type: 'IN',
        quantity: 10,
        reason: 'Initial stock',
        productId: product.id,
        userId: user.id,
      },
    });
  }

  console.log('✅ Sample stock movements created');
  console.log('🎉 Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 