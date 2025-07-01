import rateLimit from 'express-rate-limit';
import { logger } from '../utils/logger';

// General API rate limiter
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later',
    retryAfter: '15 minutes',
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res, next, options) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path,
    });
    
    res.status(options.statusCode).json(options.message);
  },
});

// Strict rate limiter for authentication routes
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login attempts per windowMs
  message: {
    error: 'Too many authentication attempts, please try again later',
    retryAfter: '15 minutes',
  },
  skipSuccessfulRequests: true, // Don't count successful requests
  handler: (req, res, next, options) => {
    logger.warn('Auth rate limit exceeded', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path,
    });
    
    res.status(options.statusCode).json(options.message);
  },
});

// More lenient limiter for GET requests
export const readLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // Limit each IP to 30 GET requests per minute
  message: {
    error: 'Too many read requests, please slow down',
    retryAfter: '1 minute',
  },
  skip: (req) => {
    // Skip rate limiting for authenticated users (you can customize this)
    return req.method !== 'GET';
  },
});

// Strict limiter for write operations
export const writeLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // Limit each IP to 20 write operations per 5 minutes
  message: {
    error: 'Too many write operations, please wait before making more changes',
    retryAfter: '5 minutes',
  },
  skip: (req) => {
    return req.method === 'GET';
  },
}); 