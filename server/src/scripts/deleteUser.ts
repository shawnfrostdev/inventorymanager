import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

async function deleteUser(email: string) {
  try {
    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, isEmailVerified: true }
    });

    if (!user) {
      console.log(`❌ No user found with email: ${email}`);
      return;
    }

    console.log(`📋 Found user:`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Name: ${user.name}`);
    console.log(`   Verified: ${user.isEmailVerified}`);
    console.log(`   ID: ${user.id}`);

    // Delete the user
    await prisma.user.delete({
      where: { email }
    });
    
    logger.info(`Successfully deleted user: ${email}`);
    console.log(`✅ Successfully deleted user: ${email}`);
  } catch (error) {
    logger.error('Error deleting user:', error);
    console.error('❌ Error deleting user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Get email from command line arguments
const email = process.argv[2];

if (!email) {
  console.log('❌ Please provide an email address');
  console.log('Usage: npm run delete-user <email>');
  console.log('Example: npm run delete-user test@example.com');
  process.exit(1);
}

// Run the script
deleteUser(email); 