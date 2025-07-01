import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { authService } from '../services/auth.service';
import { AppError } from '../utils/error';
import { JWTPayload } from '../types/auth.types';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

export const protect = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new AppError('No token provided', 401);
    }

    const token = authHeader.split(' ')[1];
    const decoded = await authService.validateToken(token);
    
    req.user = decoded;
    next();
  } catch (error) {
    next(new AppError('Not authorized', 401));
  }
};

export const restrictTo = (...roles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('Not authorized', 401));
    }

    if (!roles.includes(req.user.role as Role)) {
      return next(new AppError('Not authorized for this action', 403));
    }

    next();
  };
}; 