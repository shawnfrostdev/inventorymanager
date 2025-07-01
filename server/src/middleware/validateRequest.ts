import { Request, Response, NextFunction } from 'express';
import { AnyZodObject } from 'zod';

export const validateRequest = (schema: AnyZodObject): ((req: Request, res: Response, next: NextFunction) => void) => {
  return function validate(req: Request, res: Response, next: NextFunction) {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      res.status(400).json({ status: 'error', message: 'Validation failed', errors: error });
    }
  };
}; 