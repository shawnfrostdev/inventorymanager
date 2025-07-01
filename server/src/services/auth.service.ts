import { PrismaClient, User } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import crypto from 'crypto';
import { LoginCredentials, RegisterCredentials, JWTPayload, AuthTokens, GoogleUser } from '../types/auth.types';
import { AppError } from '../middleware/errorHandler';
import { emailService } from '../utils/email';
import { generateTokens } from '../utils/jwt';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();
const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'http://localhost:3000/auth/google/callback'
);

class AuthService {
  private readonly JWT_SECRET: string;
  private readonly JWT_REFRESH_SECRET: string;
  private readonly JWT_EXPIRES_IN: string;
  private readonly JWT_REFRESH_EXPIRES_IN: string;
  private prisma: PrismaClient;

  constructor() {
    this.JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
    this.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key';
    this.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
    this.JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
    this.prisma = new PrismaClient();
  }

  async register(name: string, email: string, password: string) {
    try {
      // Check if user already exists
      const existingUser = await this.prisma.user.findUnique({
        where: { email }
      });

      if (existingUser) {
        throw new AppError(400, 'Email already registered');
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);

      // Generate verification token
      const verificationToken = crypto.randomBytes(32).toString('hex');
      const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Create user
      const user = await this.prisma.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          verificationToken,
          verificationTokenExpires,
          role: 'USER'
        }
      });

      // Send verification email
      await emailService.sendVerificationEmail(email, verificationToken);

      // Generate tokens
      const tokens = generateTokens(user);

      // Return user without password
      const { password: _, ...userWithoutPassword } = user;
      return {
        user: userWithoutPassword,
        ...tokens
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Registration error:', error);
      throw new AppError(500, 'Registration failed. Please try again.');
    }
  }

  async verifyEmail(token: string) {
    try {
      // Find user with token
      const user = await this.prisma.user.findFirst({
        where: {
          verificationToken: token,
          verificationTokenExpires: {
            gt: new Date()
          }
        }
      });

      if (!user) {
        throw new AppError(400, 'Invalid or expired verification token');
      }

      // Update user
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          isEmailVerified: true,
          verificationToken: null,
          verificationTokenExpires: null
        }
      });

      return { message: 'Email verified successfully' };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Email verification error:', error);
      throw new AppError(500, 'Email verification failed. Please try again.');
    }
  }

  async requestPasswordReset(email: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new AppError(404, 'No user found with this email');
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken,
        resetTokenExpires
      }
    });

    await emailService.sendPasswordResetEmail(email, resetToken);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpires: {
          gt: new Date()
        }
      }
    });

    if (!user) {
      throw new AppError(400, 'Invalid or expired reset token');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpires: null
      }
    });
  }

  async login(email: string, password: string) {
    try {
      logger.info(`Attempting login for email: ${email}`);

      // Find user
      const user = await this.prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          password: true,
          name: true,
          role: true,
          isEmailVerified: true
        }
      });

      if (!user) {
        logger.info(`No user found with email: ${email}`);
        throw new AppError(401, 'Invalid email or password');
      }

      logger.info(`User found, checking password...`);

      // Check password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      
      if (!isPasswordValid) {
        logger.info(`Invalid password for email: ${email}`);
        throw new AppError(401, 'Invalid email or password');
      }

      // Check if email is verified
      if (!user.isEmailVerified) {
        logger.info(`Email not verified for: ${email}`);
        throw new AppError(401, 'Please verify your email before logging in');
      }

      logger.info(`Login successful for: ${email}`);

      // Generate tokens
      const tokens = generateTokens(user);

      // Return user without password and with tokens
      const { password: _, ...userWithoutPassword } = user;
      return {
        user: userWithoutPassword,
        ...tokens
      };
    } catch (error) {
      // If it's already an AppError, rethrow it
      if (error instanceof AppError) {
        throw error;
      }
      // Log unexpected errors
      logger.error('Login error:', error);
      throw new AppError(500, 'An error occurred during login. Please try again.');
    }
  }

  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    try {
      // Verify refresh token
      const { verifyRefreshToken } = await import('../utils/jwt');
      const decoded = verifyRefreshToken(refreshToken);
      
      // Get user
      const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
      if (!user) {
        throw new AppError(404, 'User not found');
      }

      // Generate new tokens
      return this.generateTokens(user);
    } catch (error) {
      throw new AppError(401, 'Invalid refresh token');
    }
  }

  async googleLogin(code: string): Promise<AuthTokens> {
    try {
      // Get tokens from Google
      const { tokens } = await googleClient.getToken(code);
      googleClient.setCredentials(tokens);

      // Get user info from Google
      const { data } = await googleClient.request<GoogleUser>({
        url: 'https://www.googleapis.com/oauth2/v2/userinfo'
      });

      // Find or create user
      let user = await prisma.user.findUnique({ where: { email: data.email } });
      
      if (!user) {
        // Create new user with Google data
        user = await prisma.user.create({
          data: {
            email: data.email,
            name: data.name,
            password: await bcrypt.hash(Math.random().toString(36), 12), // Random password
            role: 'USER',
            googleId: data.id,
            picture: data.picture
          }
        });
      } else if (!user.googleId) {
        // Update existing user with Google data
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            googleId: data.id,
            picture: data.picture
          }
        });
      }

      // Generate tokens
      return this.generateTokens(user);
    } catch (error) {
      throw new AppError(401, 'Failed to authenticate with Google');
    }
  }

  private generateTokens(user: User): AuthTokens {
    return generateTokens(user);
  }

  async validateToken(token: string): Promise<JWTPayload> {
    try {
      const { verifyToken } = await import('../utils/jwt');
      return verifyToken(token);
    } catch (error) {
      throw new AppError(401, 'Invalid token');
    }
  }
}

export const authService = new AuthService(); 