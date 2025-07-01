import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function checkUser(email: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        password: true,
        name: true,
        role: true,
        isEmailVerified: true,
        createdAt: true
      }
    });

    if (!user) {
      console.log('No user found with this email');
      return;
    }

    console.log('User found:');
    console.log('ID:', user.id);
    console.log('Email:', user.email);
    console.log('Name:', user.name);
    console.log('Role:', user.role);
    console.log('Email Verified:', user.isEmailVerified);
    console.log('Created At:', user.createdAt);
    console.log('Password Hash Length:', user.password.length);
  } catch (error) {
    console.error('Error checking user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Check the specific user
checkUser('sohandesignz@gmail.com'); 