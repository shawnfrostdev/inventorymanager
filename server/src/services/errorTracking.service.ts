import { logger } from '../utils/logger';
import { socketService } from './socket.service';

export interface ErrorDetails {
  id: string;
  timestamp: Date;
  level: 'error' | 'warning' | 'critical';
  message: string;
  stack?: string;
  userId?: string;
  userAgent?: string;
  ip?: string;
  endpoint?: string;
  method?: string;
  statusCode?: number;
  context?: Record<string, any>;
  resolved?: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
}

export interface ErrorStats {
  totalErrors: number;
  recentErrors: number;
  criticalErrors: number;
  topErrors: Array<{
    message: string;
    count: number;
    lastOccurred: Date;
  }>;
  errorsByEndpoint: Array<{
    endpoint: string;
    count: number;
  }>;
}

class ErrorTrackingService {
  private errors: Map<string, ErrorDetails> = new Map();
  private errorCounts: Map<string, number> = new Map();
  private readonly maxStoredErrors = 1000;
  private readonly alertThreshold = 10; // Alert after 10 errors in 5 minutes

  // Track a new error
  trackError(error: Error | string, context: {
    userId?: string;
    userAgent?: string;
    ip?: string;
    endpoint?: string;
    method?: string;
    statusCode?: number;
    level?: 'error' | 'warning' | 'critical';
    additionalContext?: Record<string, any>;
  } = {}): string {
    const errorId = this.generateErrorId();
    const timestamp = new Date();
    
    const errorMessage = typeof error === 'string' ? error : error.message;
    const errorStack = typeof error === 'string' ? undefined : error.stack;

    const errorDetails: ErrorDetails = {
      id: errorId,
      timestamp,
      level: context.level || 'error',
      message: errorMessage,
      stack: errorStack,
      userId: context.userId,
      userAgent: context.userAgent,
      ip: context.ip,
      endpoint: context.endpoint,
      method: context.method,
      statusCode: context.statusCode,
      context: context.additionalContext,
      resolved: false,
    };

    // Store error
    this.errors.set(errorId, errorDetails);

    // Update error count for this message
    const count = this.errorCounts.get(errorMessage) || 0;
    this.errorCounts.set(errorMessage, count + 1);

    // Clean up old errors if we exceed the limit
    if (this.errors.size > this.maxStoredErrors) {
      this.cleanupOldErrors();
    }

    // Log the error
    logger.error('Error tracked', {
      errorId,
      message: errorMessage,
      userId: context.userId,
      endpoint: context.endpoint,
      level: context.level,
    });

    // Check if we need to send alerts
    this.checkAlertThreshold(errorMessage);

    // Send real-time notification for critical errors
    if (context.level === 'critical') {
      this.sendCriticalErrorAlert(errorDetails);
    }

    return errorId;
  }

  // Get error by ID
  getError(errorId: string): ErrorDetails | null {
    return this.errors.get(errorId) || null;
  }

  // Get recent errors
  getRecentErrors(limit: number = 50): ErrorDetails[] {
    const errors = Array.from(this.errors.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);

    return errors;
  }

  // Get errors by user
  getUserErrors(userId: string, limit: number = 20): ErrorDetails[] {
    const errors = Array.from(this.errors.values())
      .filter(error => error.userId === userId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);

    return errors;
  }

  // Get errors by endpoint
  getEndpointErrors(endpoint: string, limit: number = 20): ErrorDetails[] {
    const errors = Array.from(this.errors.values())
      .filter(error => error.endpoint === endpoint)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);

    return errors;
  }

  // Mark error as resolved
  resolveError(errorId: string, resolvedBy: string): boolean {
    const error = this.errors.get(errorId);
    if (!error) {
      return false;
    }

    error.resolved = true;
    error.resolvedAt = new Date();
    error.resolvedBy = resolvedBy;

    logger.info('Error resolved', { errorId, resolvedBy });
    return true;
  }

  // Get error statistics
  getErrorStats(): ErrorStats {
    const errors = Array.from(this.errors.values());
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);

    // Recent errors (last hour)
    const recentErrors = errors.filter(error => 
      error.timestamp.getTime() > oneHourAgo
    ).length;

    // Critical errors
    const criticalErrors = errors.filter(error => 
      error.level === 'critical'
    ).length;

    // Top errors by frequency
    const errorFrequency = new Map<string, { count: number; lastOccurred: Date }>();
    errors.forEach(error => {
      const existing = errorFrequency.get(error.message);
      if (existing) {
        existing.count++;
        if (error.timestamp > existing.lastOccurred) {
          existing.lastOccurred = error.timestamp;
        }
      } else {
        errorFrequency.set(error.message, {
          count: 1,
          lastOccurred: error.timestamp,
        });
      }
    });

    const topErrors = Array.from(errorFrequency.entries())
      .map(([message, data]) => ({ message, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Errors by endpoint
    const endpointErrors = new Map<string, number>();
    errors.forEach(error => {
      if (error.endpoint) {
        const count = endpointErrors.get(error.endpoint) || 0;
        endpointErrors.set(error.endpoint, count + 1);
      }
    });

    const errorsByEndpoint = Array.from(endpointErrors.entries())
      .map(([endpoint, count]) => ({ endpoint, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalErrors: errors.length,
      recentErrors,
      criticalErrors,
      topErrors,
      errorsByEndpoint,
    };
  }

  // Clean up old errors
  private cleanupOldErrors(): void {
    const errors = Array.from(this.errors.entries())
      .sort(([, a], [, b]) => a.timestamp.getTime() - b.timestamp.getTime());

    // Remove oldest 10% of errors
    const toRemove = Math.floor(errors.length * 0.1);
    for (let i = 0; i < toRemove; i++) {
      this.errors.delete(errors[i][0]);
    }

    logger.info('Cleaned up old errors', { removedCount: toRemove });
  }

  // Check if we need to send alerts
  private checkAlertThreshold(errorMessage: string): void {
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    const recentSameErrors = Array.from(this.errors.values())
      .filter(error => 
        error.message === errorMessage && 
        error.timestamp.getTime() > fiveMinutesAgo
      ).length;

    if (recentSameErrors >= this.alertThreshold) {
      this.sendErrorAlert(errorMessage, recentSameErrors);
    }
  }

  // Send error alert
  private sendErrorAlert(errorMessage: string, count: number): void {
    logger.warn('Error threshold exceeded', { errorMessage, count });

    // Send real-time alert
    socketService.emitSystemAlert({
      type: 'error',
      message: `Error threshold exceeded: "${errorMessage}" occurred ${count} times in the last 5 minutes`,
      data: { errorMessage, count, threshold: this.alertThreshold },
    });
  }

  // Send critical error alert
  private sendCriticalErrorAlert(error: ErrorDetails): void {
    logger.error('Critical error detected', { errorId: error.id, message: error.message });

    // Send real-time critical alert
    socketService.emitSystemAlert({
      type: 'error',
      message: `Critical Error: ${error.message}`,
      data: {
        errorId: error.id,
        endpoint: error.endpoint,
        userId: error.userId,
        timestamp: error.timestamp,
      },
    });
  }

  // Generate unique error ID
  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Express middleware to automatically track errors
  middleware() {
    return (err: any, req: any, res: any, next: any) => {
      const errorId = this.trackError(err, {
        userId: req.user?.id,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        endpoint: req.path,
        method: req.method,
        statusCode: res.statusCode || 500,
        level: res.statusCode >= 500 ? 'critical' : 'error',
        additionalContext: {
          body: req.body,
          query: req.query,
          params: req.params,
        },
      });

      // Add error ID to response headers for debugging
      res.setHeader('X-Error-ID', errorId);

      next(err);
    };
  }

  // Health check method
  getHealthStatus(): {
    status: 'healthy' | 'warning' | 'critical';
    details: {
      recentErrorRate: number;
      criticalErrors: number;
      systemLoad: string;
    };
  } {
    const stats = this.getErrorStats();
    const recentErrorRate = stats.recentErrors;
    
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    
    if (stats.criticalErrors > 0) {
      status = 'critical';
    } else if (recentErrorRate > 20) {
      status = 'critical';
    } else if (recentErrorRate > 5) {
      status = 'warning';
    }

    return {
      status,
      details: {
        recentErrorRate,
        criticalErrors: stats.criticalErrors,
        systemLoad: `${this.errors.size}/${this.maxStoredErrors} errors stored`,
      },
    };
  }

  // Export errors for analysis
  exportErrors(format: 'json' | 'csv' = 'json'): string {
    const errors = Array.from(this.errors.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (format === 'json') {
      return JSON.stringify(errors, null, 2);
    } else {
      // CSV format
      const headers = 'ID,Timestamp,Level,Message,UserId,Endpoint,Method,StatusCode,Resolved\n';
      const rows = errors.map(error => 
        `${error.id},${error.timestamp.toISOString()},${error.level},"${error.message}",${error.userId || ''},${error.endpoint || ''},${error.method || ''},${error.statusCode || ''},${error.resolved}`
      ).join('\n');
      
      return headers + rows;
    }
  }
}

// Export singleton instance
export const errorTrackingService = new ErrorTrackingService(); 