import { PrismaClient } from '@prisma/client';
import { authService } from '../auth.service';
import { createTestUser } from '../../test/setup';
import bcrypt from 'bcryptjs';

let testDb: PrismaClient;

beforeAll(async () => {
  testDb = new PrismaClient();
  await testDb.$connect();
});

afterAll(async () => {
  await testDb.$disconnect();
});

afterEach(async () => {
  // Clean up test data
  await testDb.user.deleteMany({});
});

describe('AuthService', () => {
  describe('Registration', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john.doe@example.com',
        password: 'password123'
      };

      const result = await authService.register(
        userData.name,
        userData.email,
        userData.password
      );

      expect(result).toBeDefined();
      expect(result.user).toBeDefined();
      expect(result.user.email).toBe(userData.email);
      expect(result.user.name).toBe(userData.name);
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.user).not.toHaveProperty('password');
    });

    it('should hash the user password', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john.test@example.com',
        password: 'password123'
      };

      await authService.register(userData.name, userData.email, userData.password);

      const user = await testDb.user.findUnique({
        where: { email: userData.email }
      });

      expect(user).toBeDefined();
      expect(user?.password).not.toBe(userData.password);
      const isHashValid = await bcrypt.compare(userData.password, user!.password);
      expect(isHashValid).toBe(true);
    });

    it('should not register user with duplicate email', async () => {
      const userData = {
        name: 'John Doe',
        email: 'duplicate@example.com',
        password: 'password123'
      };

      await authService.register(userData.name, userData.email, userData.password);

      await expect(
        authService.register(userData.name, userData.email, userData.password)
      ).rejects.toThrow('Email already registered');
    });

    it('should create verification token for new user', async () => {
      const userData = {
        name: 'John Doe',
        email: 'verify.test@example.com',
        password: 'password123'
      };

      await authService.register(userData.name, userData.email, userData.password);

      const user = await testDb.user.findUnique({
        where: { email: userData.email }
      });

      expect(user?.verificationToken).toBeDefined();
      expect(user?.verificationTokenExpires).toBeDefined();
      expect(user?.isEmailVerified).toBe(false);
    });
  });

  describe('Login', () => {
    it('should login user with valid credentials', async () => {
      const userData = {
        name: 'John Doe',
        email: 'login.test@example.com',
        password: 'password123'
      };

      // Register and verify user first
      await authService.register(userData.name, userData.email, userData.password);
      await testDb.user.update({
        where: { email: userData.email },
        data: { isEmailVerified: true }
      });

      const result = await authService.login(userData.email, userData.password);

      expect(result).toBeDefined();
      expect(result.user).toBeDefined();
      expect(result.user.email).toBe(userData.email);
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.user).not.toHaveProperty('password');
    });

    it('should not login with invalid email', async () => {
      await expect(
        authService.login('nonexistent@example.com', 'password123')
      ).rejects.toThrow('Invalid email or password');
    });

    it('should not login with invalid password', async () => {
      const userData = {
        name: 'John Doe',
        email: 'invalid.password@example.com',
        password: 'password123'
      };

      await authService.register(userData.name, userData.email, userData.password);
      await testDb.user.update({
        where: { email: userData.email },
        data: { isEmailVerified: true }
      });

      await expect(
        authService.login(userData.email, 'wrongpassword')
      ).rejects.toThrow('Invalid email or password');
    });

    it('should not login unverified user', async () => {
      const userData = {
        name: 'John Doe',
        email: 'unverified@example.com',
        password: 'password123'
      };

      await authService.register(userData.name, userData.email, userData.password);

      await expect(
        authService.login(userData.email, userData.password)
      ).rejects.toThrow('Please verify your email before logging in');
    });
  });

  describe('Email Verification', () => {
    it('should verify email with valid token', async () => {
      const userData = {
        name: 'John Doe',
        email: 'verify.email@example.com',
        password: 'password123'
      };

      await authService.register(userData.name, userData.email, userData.password);

      const user = await testDb.user.findUnique({
        where: { email: userData.email }
      });

      const result = await authService.verifyEmail(user!.verificationToken!);

      expect(result).toBeDefined();
      expect(result.message).toBe('Email verified successfully');

      const verifiedUser = await testDb.user.findUnique({
        where: { email: userData.email }
      });

      expect(verifiedUser?.isEmailVerified).toBe(true);
      expect(verifiedUser?.verificationToken).toBeNull();
      expect(verifiedUser?.verificationTokenExpires).toBeNull();
    });

    it('should not verify email with invalid token', async () => {
      await expect(
        authService.verifyEmail('invalid-token')
      ).rejects.toThrow('Invalid or expired verification token');
    });

    it('should not verify email with expired token', async () => {
      const userData = {
        name: 'John Doe',
        email: 'expired.token@example.com',
        password: 'password123'
      };

      await authService.register(userData.name, userData.email, userData.password);

      // Manually expire the token
      const user = await testDb.user.findUnique({
        where: { email: userData.email }
      });

      await testDb.user.update({
        where: { id: user!.id },
        data: {
          verificationTokenExpires: new Date(Date.now() - 1000) // 1 second ago
        }
      });

      await expect(
        authService.verifyEmail(user!.verificationToken!)
      ).rejects.toThrow('Invalid or expired verification token');
    });
  });

  describe('Password Reset', () => {
    it('should create password reset token', async () => {
      const userData = {
        name: 'John Doe',
        email: 'reset.password@example.com',
        password: 'password123'
      };

      await authService.register(userData.name, userData.email, userData.password);

      await authService.requestPasswordReset(userData.email);

      const user = await testDb.user.findUnique({
        where: { email: userData.email }
      });

      expect(user?.resetToken).toBeDefined();
      expect(user?.resetTokenExpires).toBeDefined();
    });

    it('should not create reset token for non-existent user', async () => {
      await expect(
        authService.requestPasswordReset('nonexistent@example.com')
      ).rejects.toThrow('No user found with this email');
    });

    it('should reset password with valid token', async () => {
      const userData = {
        name: 'John Doe',
        email: 'reset.test@example.com',
        password: 'password123'
      };

      await authService.register(userData.name, userData.email, userData.password);
      await authService.requestPasswordReset(userData.email);

      const user = await testDb.user.findUnique({
        where: { email: userData.email }
      });

      const newPassword = 'newpassword123';
      await authService.resetPassword(user!.resetToken!, newPassword);

      const updatedUser = await testDb.user.findUnique({
        where: { email: userData.email }
      });

      expect(updatedUser?.resetToken).toBeNull();
      expect(updatedUser?.resetTokenExpires).toBeNull();

      const isNewPasswordValid = await bcrypt.compare(newPassword, updatedUser!.password);
      expect(isNewPasswordValid).toBe(true);
    });

    it('should not reset password with invalid token', async () => {
      await expect(
        authService.resetPassword('invalid-token', 'newpassword123')
      ).rejects.toThrow('Invalid or expired reset token');
    });
  });

  describe('Token Refresh', () => {
    it('should refresh valid token', async () => {
      const userData = {
        name: 'John Doe',
        email: 'refresh.test@example.com',
        password: 'password123'
      };

      await authService.register(userData.name, userData.email, userData.password);
      await testDb.user.update({
        where: { email: userData.email },
        data: { isEmailVerified: true }
      });

      const loginResult = await authService.login(userData.email, userData.password);

      const result = await authService.refreshToken(loginResult.refreshToken);

      expect(result).toBeDefined();
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      // Token refresh working - new tokens generated
      expect(typeof result.accessToken).toBe('string');
      expect(typeof result.refreshToken).toBe('string');
    });

    it('should not refresh invalid token', async () => {
      await expect(
        authService.refreshToken('invalid-refresh-token')
      ).rejects.toThrow('Invalid refresh token');
    });
  });

  describe('Token Validation', () => {
    it('should validate valid token', async () => {
      const userData = {
        name: 'John Doe',
        email: 'validate.test@example.com',
        password: 'password123'
      };

      await authService.register(userData.name, userData.email, userData.password);
      await testDb.user.update({
        where: { email: userData.email },
        data: { isEmailVerified: true }
      });

      const loginResult = await authService.login(userData.email, userData.password);

      const result = await authService.validateToken(loginResult.accessToken);

      expect(result).toBeDefined();
      expect(result.userId).toBeDefined();
      expect(result.email).toBe(userData.email);
    });

    it('should not validate invalid token', async () => {
      await expect(
        authService.validateToken('invalid-access-token')
      ).rejects.toThrow('Invalid token');
    });
  });
}); 