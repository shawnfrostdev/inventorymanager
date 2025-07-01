import nodemailer from 'nodemailer';
import { logger } from './logger';

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Verify the connection configuration
transporter.verify((error, success) => {
  if (error) {
    logger.error('SMTP connection error:', error);
  } else {
    logger.info('SMTP server is ready to send emails');
  }
});

export const emailService = {
  async sendVerificationEmail(to: string, token: string) {
    const verificationUrl = `${process.env.CLIENT_URL}/auth/verify-email?token=${token}`;
    
    try {
      const info = await transporter.sendMail({
        from: process.env.EMAIL_FROM,
        to,
        subject: 'Verify Your Email',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Welcome to Inventory Manager!</h2>
            <p>Please click the button below to verify your email address:</p>
            <a href="${verificationUrl}" 
               style="display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; 
                      text-decoration: none; border-radius: 6px; margin: 16px 0;">
              Verify Email
            </a>
            <p>Or copy and paste this link in your browser:</p>
            <p style="color: #4F46E5;">${verificationUrl}</p>
            <p>This link will expire in 24 hours.</p>
            <p>If you didn't create an account, you can safely ignore this email.</p>
          </div>
        `,
      });
      logger.info('Verification email sent:', info.messageId);
      return true;
    } catch (error) {
      logger.error('Error sending verification email:', error);
      throw error;
    }
  },

  async sendPasswordResetEmail(to: string, token: string) {
    const resetUrl = `${process.env.CLIENT_URL}/auth/reset-password?token=${token}`;
    
    try {
      const info = await transporter.sendMail({
        from: process.env.EMAIL_FROM,
        to,
        subject: 'Reset Your Password',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Password Reset Request</h2>
            <p>You requested to reset your password. Click the button below to proceed:</p>
            <a href="${resetUrl}" 
               style="display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; 
                      text-decoration: none; border-radius: 6px; margin: 16px 0;">
              Reset Password
            </a>
            <p>Or copy and paste this link in your browser:</p>
            <p style="color: #4F46E5;">${resetUrl}</p>
            <p>This link will expire in 1 hour.</p>
            <p>If you didn't request a password reset, you can safely ignore this email.</p>
          </div>
        `,
      });
      logger.info('Password reset email sent:', info.messageId);
      return true;
    } catch (error) {
      logger.error('Error sending password reset email:', error);
      throw error;
    }
  }
}; 