import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export class AppError extends Error {
  statusCode: number;
  status: string;

  constructor(statusCode: number, message: string, status: string = 'error') {
    super(message);
    this.statusCode = statusCode;
    this.status = status;
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: Error | AppError | any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Log the error for debugging
  logger.error('Error:', err);

  // Default error response
  const errorResponse = {
    status: 'error',
    message: 'Something went wrong',
    statusCode: 500
  };

  // Handle AppError instances
  if (err instanceof AppError) {
    errorResponse.status = err.status;
    errorResponse.message = err.message;
    errorResponse.statusCode = err.statusCode;
  } 
  // Handle Prisma errors
  else if (err.code && typeof err.code === 'string' && err.code.startsWith('P')) {
    errorResponse.statusCode = 400;
    errorResponse.message = 'Database operation failed';
  }
  // Handle validation errors
  else if (err.name === 'ValidationError') {
    errorResponse.statusCode = 400;
    errorResponse.message = err.message;
  }
  // Handle JWT errors
  else if (err.name === 'JsonWebTokenError') {
    errorResponse.statusCode = 401;
    errorResponse.message = 'Invalid token';
  }
  else if (err.name === 'TokenExpiredError') {
    errorResponse.statusCode = 401;
    errorResponse.message = 'Token expired';
  }

  // Ensure we're sending a JSON response
  res.setHeader('Content-Type', 'application/json');
  
  // Send response
  return res.status(errorResponse.statusCode).json({
    status: errorResponse.status,
    message: errorResponse.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
}; 