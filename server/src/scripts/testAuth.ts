import { PrismaClient } from '@prisma/client';
import { authService } from '../services/auth.service';

const prisma = new PrismaClient();

async function main() {
  console.log('🔐 Testing authentication...');

  try {
    // Test login with the seeded admin user
    const loginResult = await authService.login('admin@inventory.com', 'password123') as any;
    
    console.log('✅ Login successful!');
    console.log('User:', {
      id: loginResult.user.id,
      email: loginResult.user.email,
      name: loginResult.user.name,
      role: loginResult.user.role,
    });
    console.log('Access Token:', loginResult.accessToken.substring(0, 50) + '...');
    
    // Test token validation
    const decodedToken = await authService.validateToken(loginResult.accessToken);
    console.log('✅ Token validation successful!');
    console.log('Decoded token:', decodedToken);
    
    // Test database access
    const products = await prisma.product.findMany({
      include: {
        category: true,
      },
    });
    console.log(`✅ Database access successful! Found ${products.length} products`);
    
    // Show some sample product data
    if (products.length > 0) {
      console.log('Sample product:', {
        id: products[0].id,
        name: products[0].name,
        sku: products[0].sku,
        category: products[0].category.name,
      });
    }

    console.log('\n🎉 All tests passed!');
    console.log('\n📋 Test Credentials:');
    console.log('Email: admin@inventory.com');
    console.log('Password: password123');
    console.log('\n🔑 Sample Access Token (for testing):');
    console.log(loginResult.accessToken);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

main()
  .catch((e) => {
    console.error('❌ Error running test:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 