import { emailService } from '../utils/email';
import { logger } from '../utils/logger';

async function testEmail() {
  try {
    await emailService.sendVerificationEmail(
      'sohandesignz@gmail.com',
      'test-verification-token'
    );
    logger.info('Test email sent successfully');
  } catch (error) {
    logger.error('Failed to send test email:', error);
  }
}

testEmail(); 