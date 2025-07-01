import express from 'express';
import { AuthController } from '../controllers/auth.controller';
import { validateRequest } from '../middleware/validateRequest';
import { registerSchema, loginSchema } from '../types/auth.types';

const router = express.Router();
const authController = new AuthController();

router.post('/register', validateRequest(registerSchema), authController.register.bind(authController));
router.post('/login', validateRequest(loginSchema), authController.login.bind(authController));
router.post('/logout', authController.logout.bind(authController));
router.get('/verify-email/:token', authController.verifyEmail.bind(authController));
router.post('/resend-verification', authController.resendVerificationEmail.bind(authController));
router.post('/request-password-reset', authController.requestPasswordReset.bind(authController));
router.post('/reset-password', authController.resetPassword.bind(authController));
router.post('/refresh-token', authController.refreshToken.bind(authController));
router.get('/google/callback', authController.googleCallback.bind(authController));

export default router; 