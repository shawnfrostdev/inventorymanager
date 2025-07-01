import { User } from '@prisma/client';
import { z } from 'zod';

export const registerSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    name: z.string().min(2, 'Name must be at least 2 characters')
  })
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(6, 'Password must be at least 6 characters')
  })
});

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  name: string;
}

export interface AuthResponse {
  user: Omit<User, 'password'>;
  token: string;
}

export interface JWTPayload {
  id: string;
  email: string;
  role: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface GoogleUser {
  email: string;
  name: string;
  picture?: string;
}

export interface GoogleTokens {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
  id_token: string;
} 