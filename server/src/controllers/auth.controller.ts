import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { LoginCredentials, RegisterCredentials } from '../types/auth.types';
import { AppError } from '../middleware/errorHandler';
import { generateTokens } from '../utils/jwt';
import { logger } from '../utils/logger';

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, email, password } = req.body;
      
      if (!name || !email || !password) {
        throw new AppError(400, 'Name, email, and password are required');
      }
      
      const result = await authService.register(name, email, password);
      
      res.status(201).json({
        status: 'success',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        throw new AppError(400, 'Email and password are required');
      }

      logger.info(`Attempting login for email: ${email}`);
      
      const result = await authService.login(email, password);
      
      res.status(200).json({
        status: 'success',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async verifyEmail(req: Request, res: Response, next: NextFunction) {
    try {
      const { token } = req.params;
      
      if (!token) {
        throw new AppError(400, 'Verification token is required');
      }
      
      const result = await authService.verifyEmail(token);
      
      res.status(200).json({
        status: 'success',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async requestPasswordReset(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = req.body;
      
      if (!email) {
        throw new AppError(400, 'Email is required');
      }
      
      await authService.requestPasswordReset(email);
      
      res.status(200).json({
        status: 'success',
        message: 'Password reset email sent successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { token, newPassword } = req.body;
      
      if (!token || !newPassword) {
        throw new AppError(400, 'Token and new password are required');
      }
      
      await authService.resetPassword(token, newPassword);
      
      res.status(200).json({
        status: 'success',
        message: 'Password reset successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  async refreshToken(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = req.body;
      
      if (!refreshToken) {
        throw new AppError(400, 'Refresh token is required');
      }
      
      const result = await authService.refreshToken(refreshToken);
      
      res.status(200).json({
        status: 'success',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      // Get the refresh token from the request body
      const { refreshToken } = req.body;

      if (!refreshToken) {
        throw new AppError(400, 'Refresh token is required');
      }

      await authService.logout(refreshToken);

      res.status(200).json({
        status: 'success',
        message: 'Successfully logged out'
      });
    } catch (error) {
      next(error);
    }
  }

  async googleCallback(req: Request, res: Response, next: NextFunction) {
    try {
      const { code } = req.query;
      
      if (!code || typeof code !== 'string') {
        throw new AppError('Authorization code is required', 400);
      }

      const tokens = await authService.googleLogin(code);

      // In a real application, you might want to redirect to the frontend with the tokens
      res.status(200).json({
        status: 'success',
        data: tokens
      });
    } catch (error) {
      next(error);
    }
  }
} 