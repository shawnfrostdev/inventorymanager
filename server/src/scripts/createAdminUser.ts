import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('👤 Creating admin user...');

  try {
    // Check if admin user already exists
    let user = await prisma.user.findUnique({
      where: { email: 'admin@inventory.com' }
    });

    if (user) {
      console.log('✅ Admin user already exists:', user.email);
      console.log('📋 Test Credentials:');
      console.log('Email: admin@inventory.com');
      console.log('Password: password123');
      return;
    }

    // Create admin user
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

    console.log('✅ Admin user created successfully!');
    console.log('User details:', {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    console.log('\n📋 Test Credentials:');
    console.log('Email: admin@inventory.com');
    console.log('Password: password123');

  } catch (error) {
    console.error('❌ Error creating admin user:', error);
  }
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 