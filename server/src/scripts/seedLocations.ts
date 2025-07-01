import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const prisma = new PrismaClient();

async function seedLocations() {
  try {
    console.log('🌱 Starting location seeding...');

    // Get a user to associate locations with
    const user = await prisma.user.findFirst();
    if (!user) {
      console.error('❌ No users found. Please create a user first.');
      return;
    }

    console.log(`📍 Creating locations for user: ${user.name}`);

    // Create sample locations
    const locations = await Promise.all([
      prisma.location.create({
        data: {
          name: 'Main Warehouse',
          description: 'Primary storage facility for all inventory',
          address: '123 Industrial Blvd, City, State 12345',
          userId: user.id,
        },
      }),
      prisma.location.create({
        data: {
          name: 'Retail Store A',
          description: 'Downtown retail location',
          address: '456 Main Street, Downtown, State 12345',
          userId: user.id,
        },
      }),
      prisma.location.create({
        data: {
          name: 'Retail Store B',
          description: 'Suburban retail location',
          address: '789 Oak Avenue, Suburbs, State 12345',
          userId: user.id,
        },
      }),
      prisma.location.create({
        data: {
          name: 'Return Processing Center',
          description: 'Facility for processing returns and refurbishments',
          address: '321 Service Road, Industrial Park, State 12345',
          userId: user.id,
        },
      }),
    ]);

    console.log(`✅ Created ${locations.length} locations:`);
    locations.forEach((location) => {
      console.log(`   - ${location.name} (${location.id})`);
    });

    // Get sample products to add stock to locations
    const products = await prisma.product.findMany({
      take: 6,
      where: { userId: user.id },
    });

    if (products.length > 0) {
      console.log('📦 Adding sample stock to locations...');
      
      // Add stock to main warehouse (highest quantities)
      const mainWarehouse = locations[0];
      const warehouseStock = await Promise.all(
        products.map((product, index) =>
          prisma.productStock.create({
            data: {
              productId: product.id,
              locationId: mainWarehouse.id,
              quantity: 100 + (index * 50), // 100, 150, 200, 250, 300, 350
            },
          })
        )
      );

      // Add some stock to retail stores (smaller quantities)
      const retailStoreA = locations[1];
      const retailStoreB = locations[2];
      
      const storeAStock = await Promise.all(
        products.slice(0, 4).map((product, index) =>
          prisma.productStock.create({
            data: {
              productId: product.id,
              locationId: retailStoreA.id,
              quantity: 10 + (index * 5), // 10, 15, 20, 25
            },
          })
        )
      );

      const storeBStock = await Promise.all(
        products.slice(2, 6).map((product, index) =>
          prisma.productStock.create({
            data: {
              productId: product.id,
              locationId: retailStoreB.id,
              quantity: 8 + (index * 4), // 8, 12, 16, 20
            },
          })
        )
      );

      console.log(`✅ Added stock to locations:`);
      console.log(`   - ${mainWarehouse.name}: ${warehouseStock.length} products`);
      console.log(`   - ${retailStoreA.name}: ${storeAStock.length} products`);
      console.log(`   - ${retailStoreB.name}: ${storeBStock.length} products`);

      // Create a sample transfer record
      const sampleTransfer = await prisma.stockMovement.create({
        data: {
          type: 'TRANSFER',
          quantity: 5,
          reason: 'Initial stock distribution to retail store',
          productId: products[0].id,
          fromLocationId: mainWarehouse.id,
          toLocationId: retailStoreA.id,
          userId: user.id,
        },
      });

      console.log(`✅ Created sample transfer record: ${sampleTransfer.id}`);
    }

    console.log('🎉 Location seeding completed successfully!');
    console.log('\n📋 Summary:');
    console.log(`   - 4 locations created`);
    console.log(`   - Stock distributed across locations`);
    console.log(`   - Sample transfer record created`);
    console.log('\n🚀 You can now test the stock transfer system!');

  } catch (error) {
    console.error('❌ Error seeding locations:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seeding
if (require.main === module) {
  seedLocations();
}

export default seedLocations; 