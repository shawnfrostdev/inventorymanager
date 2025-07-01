import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

async function clearUsers() {
  try {
    // Delete all users
    const deletedCount = await prisma.user.deleteMany({});
    
    logger.info(`Successfully deleted ${deletedCount.count} users`);
    console.log(`Successfully deleted ${deletedCount.count} users`);
  } catch (error) {
    logger.error('Error clearing users:', error);
    console.error('Error clearing users:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
clearUsers(); 