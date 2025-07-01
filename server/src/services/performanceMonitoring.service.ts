import { logger } from '../utils/logger';
import { socketService } from './socket.service';

export interface PerformanceMetric {
  timestamp: Date;
  endpoint: string;
  method: string;
  responseTime: number;
  statusCode: number;
  memoryUsage: number;
  cpuUsage?: number;
  userId?: string;
}

export interface SystemMetrics {
  timestamp: Date;
  memoryUsage: {
    used: number;
    total: number;
    percentage: number;
  };
  cpuUsage: number;
  uptime: number;
  activeConnections: number;
  requestsPerMinute: number;
  averageResponseTime: number;
  errorRate: number;
}

export interface PerformanceStats {
  averageResponseTime: number;
  p95ResponseTime: number;
  slowestEndpoints: Array<{
    endpoint: string;
    averageTime: number;
    requestCount: number;
  }>;
  requestVolume: number;
  errorRate: number;
  systemHealth: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
}

class PerformanceMonitoringService {
  private metrics: PerformanceMetric[] = [];
  private systemMetrics: SystemMetrics[] = [];
  private readonly maxMetrics = 10000;
  private readonly maxSystemMetrics = 1440; // 24 hours of minute-by-minute data
  private monitoringInterval: NodeJS.Timeout | null = null;

  // Start monitoring
  startMonitoring(): void {
    if (this.monitoringInterval) {
      return; // Already running
    }

    // Collect system metrics every minute
    this.monitoringInterval = setInterval(() => {
      this.collectSystemMetrics();
    }, 60 * 1000);

    logger.info('Performance monitoring started');
  }

  // Stop monitoring
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      logger.info('Performance monitoring stopped');
    }
  }

  // Middleware to track API performance
  middleware() {
    return (req: any, res: any, next: any) => {
      const startTime = Date.now();

      // Override res.end to capture response time
      const originalEnd = res.end;
      res.end = function(...args: any[]) {
        const responseTime = Date.now() - startTime;
        
        // Record the metric
        performanceMonitoringService.recordMetric({
          endpoint: req.path,
          method: req.method,
          responseTime,
          statusCode: res.statusCode,
          userId: req.user?.id,
        });

        // Call original end
        originalEnd.apply(res, args);
      };

      next();
    };
  }

  // Record a performance metric
  recordMetric(data: {
    endpoint: string;
    method: string;
    responseTime: number;
    statusCode: number;
    userId?: string;
  }): void {
    const metric: PerformanceMetric = {
      timestamp: new Date(),
      endpoint: data.endpoint,
      method: data.method,
      responseTime: data.responseTime,
      statusCode: data.statusCode,
      memoryUsage: this.getMemoryUsage(),
      userId: data.userId,
    };

    this.metrics.push(metric);

    // Alert on slow responses
    if (data.responseTime > 5000) { // 5 seconds
      this.alertSlowResponse(metric);
    }

    // Clean up old metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }

    // Log very slow responses
    if (data.responseTime > 10000) {
      logger.warn('Very slow response detected', {
        endpoint: data.endpoint,
        method: data.method,
        responseTime: data.responseTime,
        userId: data.userId,
      });
    }
  }

  // Get current memory usage in MB
  private getMemoryUsage(): number {
    const memoryUsage = process.memoryUsage();
    return Math.round(memoryUsage.heapUsed / 1024 / 1024);
  }

  // Get current CPU usage (simplified)
  private getCPUUsage(): number {
    const usage = process.cpuUsage();
    return Math.round((usage.user + usage.system) / 1000000); // Convert to seconds
  }

  // Collect system metrics
  private collectSystemMetrics(): void {
    const memoryUsage = process.memoryUsage();
    const memoryTotal = memoryUsage.heapTotal;
    const memoryUsed = memoryUsage.heapUsed;

    // Calculate requests per minute
    const oneMinuteAgo = Date.now() - 60000;
    const recentMetrics = this.metrics.filter(m => m.timestamp.getTime() > oneMinuteAgo);
    const requestsPerMinute = recentMetrics.length;

    // Calculate average response time
    const averageResponseTime = recentMetrics.length > 0
      ? recentMetrics.reduce((sum, m) => sum + m.responseTime, 0) / recentMetrics.length
      : 0;

    // Calculate error rate
    const errorRequests = recentMetrics.filter(m => m.statusCode >= 400).length;
    const errorRate = recentMetrics.length > 0 ? (errorRequests / recentMetrics.length) * 100 : 0;

    const systemMetric: SystemMetrics = {
      timestamp: new Date(),
      memoryUsage: {
        used: Math.round(memoryUsed / 1024 / 1024),
        total: Math.round(memoryTotal / 1024 / 1024),
        percentage: Math.round((memoryUsed / memoryTotal) * 100),
      },
      cpuUsage: this.getCPUUsage(),
      uptime: Math.round(process.uptime()),
      activeConnections: socketService.getConnectedUsersCount(),
      requestsPerMinute,
      averageResponseTime: Math.round(averageResponseTime),
      errorRate: Math.round(errorRate * 100) / 100,
    };

    this.systemMetrics.push(systemMetric);

    // Alert on high resource usage
    this.checkResourceAlerts(systemMetric);

    // Clean up old system metrics
    if (this.systemMetrics.length > this.maxSystemMetrics) {
      this.systemMetrics = this.systemMetrics.slice(-this.maxSystemMetrics);
    }

    // Send real-time system metrics to connected users
    socketService.emitSystemAlert({
      type: 'info',
      message: 'System metrics updated',
      data: systemMetric,
    });
  }

  // Check for resource alerts
  private checkResourceAlerts(metrics: SystemMetrics): void {
    // High memory usage alert
    if (metrics.memoryUsage.percentage > 85) {
      logger.warn('High memory usage detected', { 
        usage: metrics.memoryUsage.percentage 
      });
      
      socketService.emitSystemAlert({
        type: 'warning',
        message: `High memory usage: ${metrics.memoryUsage.percentage}%`,
        data: { memoryUsage: metrics.memoryUsage },
      });
    }

    // High error rate alert
    if (metrics.errorRate > 10) {
      logger.warn('High error rate detected', { 
        errorRate: metrics.errorRate 
      });
      
      socketService.emitSystemAlert({
        type: 'warning',
        message: `High error rate: ${metrics.errorRate}%`,
        data: { errorRate: metrics.errorRate },
      });
    }

    // Slow response time alert
    if (metrics.averageResponseTime > 3000) {
      logger.warn('Slow average response time detected', { 
        averageResponseTime: metrics.averageResponseTime 
      });
      
      socketService.emitSystemAlert({
        type: 'warning',
        message: `Slow average response time: ${metrics.averageResponseTime}ms`,
        data: { averageResponseTime: metrics.averageResponseTime },
      });
    }
  }

  // Alert on slow individual responses
  private alertSlowResponse(metric: PerformanceMetric): void {
    logger.warn('Slow response detected', {
      endpoint: metric.endpoint,
      method: metric.method,
      responseTime: metric.responseTime,
    });

    socketService.emitSystemAlert({
      type: 'warning',
      message: `Slow response: ${metric.method} ${metric.endpoint} took ${metric.responseTime}ms`,
      data: {
        endpoint: metric.endpoint,
        method: metric.method,
        responseTime: metric.responseTime,
      },
    });
  }

  // Get performance statistics
  getPerformanceStats(timeRange: 'hour' | 'day' | 'week' = 'hour'): PerformanceStats {
    const timeRangeMs = this.getTimeRangeMs(timeRange);
    const cutoffTime = Date.now() - timeRangeMs;
    
    const relevantMetrics = this.metrics.filter(m => 
      m.timestamp.getTime() > cutoffTime
    );

    if (relevantMetrics.length === 0) {
      return {
        averageResponseTime: 0,
        p95ResponseTime: 0,
        slowestEndpoints: [],
        requestVolume: 0,
        errorRate: 0,
        systemHealth: 'excellent',
      };
    }

    // Calculate average response time
    const totalResponseTime = relevantMetrics.reduce((sum, m) => sum + m.responseTime, 0);
    const averageResponseTime = totalResponseTime / relevantMetrics.length;

    // Calculate P95 response time
    const sortedTimes = relevantMetrics
      .map(m => m.responseTime)
      .sort((a, b) => a - b);
    const p95Index = Math.floor(sortedTimes.length * 0.95);
    const p95ResponseTime = sortedTimes[p95Index] || 0;

    // Calculate slowest endpoints
    const endpointStats = new Map<string, { totalTime: number; count: number }>();
    relevantMetrics.forEach(metric => {
      const key = `${metric.method} ${metric.endpoint}`;
      const existing = endpointStats.get(key);
      if (existing) {
        existing.totalTime += metric.responseTime;
        existing.count++;
      } else {
        endpointStats.set(key, { totalTime: metric.responseTime, count: 1 });
      }
    });

    const slowestEndpoints = Array.from(endpointStats.entries())
      .map(([endpoint, stats]) => ({
        endpoint,
        averageTime: Math.round(stats.totalTime / stats.count),
        requestCount: stats.count,
      }))
      .sort((a, b) => b.averageTime - a.averageTime)
      .slice(0, 10);

    // Calculate error rate
    const errorCount = relevantMetrics.filter(m => m.statusCode >= 400).length;
    const errorRate = (errorCount / relevantMetrics.length) * 100;

    // Determine system health
    let systemHealth: 'excellent' | 'good' | 'fair' | 'poor' | 'critical' = 'excellent';
    if (errorRate > 10 || averageResponseTime > 5000) {
      systemHealth = 'critical';
    } else if (errorRate > 5 || averageResponseTime > 3000) {
      systemHealth = 'poor';
    } else if (errorRate > 2 || averageResponseTime > 1500) {
      systemHealth = 'fair';
    } else if (errorRate > 1 || averageResponseTime > 800) {
      systemHealth = 'good';
    }

    return {
      averageResponseTime: Math.round(averageResponseTime),
      p95ResponseTime: Math.round(p95ResponseTime),
      slowestEndpoints,
      requestVolume: relevantMetrics.length,
      errorRate: Math.round(errorRate * 100) / 100,
      systemHealth,
    };
  }

  // Get system metrics for dashboard
  getSystemMetrics(timeRange: 'hour' | 'day' = 'hour'): SystemMetrics[] {
    const timeRangeMs = this.getTimeRangeMs(timeRange);
    const cutoffTime = Date.now() - timeRangeMs;
    
    return this.systemMetrics.filter(m => 
      m.timestamp.getTime() > cutoffTime
    );
  }

  // Get endpoint performance data
  getEndpointPerformance(endpoint: string, timeRange: 'hour' | 'day' = 'hour') {
    const timeRangeMs = this.getTimeRangeMs(timeRange);
    const cutoffTime = Date.now() - timeRangeMs;
    
    const endpointMetrics = this.metrics.filter(m => 
      m.endpoint === endpoint && m.timestamp.getTime() > cutoffTime
    );

    if (endpointMetrics.length === 0) {
      return null;
    }

    const responseTimes = endpointMetrics.map(m => m.responseTime);
    const errorCount = endpointMetrics.filter(m => m.statusCode >= 400).length;

    return {
      endpoint,
      requestCount: endpointMetrics.length,
      averageResponseTime: Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length),
      minResponseTime: Math.min(...responseTimes),
      maxResponseTime: Math.max(...responseTimes),
      errorRate: Math.round((errorCount / endpointMetrics.length) * 100 * 100) / 100,
      timeline: endpointMetrics.map(m => ({
        timestamp: m.timestamp,
        responseTime: m.responseTime,
        statusCode: m.statusCode,
      })),
    };
  }

  // Get health check status
  getHealthCheck(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    uptime: number;
    metrics: PerformanceStats;
    systemMetrics: SystemMetrics | null;
  } {
    const stats = this.getPerformanceStats('hour');
    const latestSystemMetrics = this.systemMetrics[this.systemMetrics.length - 1] || null;

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (stats.systemHealth === 'critical') {
      status = 'unhealthy';
    } else if (stats.systemHealth === 'poor' || stats.systemHealth === 'fair') {
      status = 'degraded';
    }

    return {
      status,
      uptime: Math.round(process.uptime()),
      metrics: stats,
      systemMetrics: latestSystemMetrics,
    };
  }

  // Helper to convert time range to milliseconds
  private getTimeRangeMs(timeRange: 'hour' | 'day' | 'week'): number {
    switch (timeRange) {
      case 'hour':
        return 60 * 60 * 1000;
      case 'day':
        return 24 * 60 * 60 * 1000;
      case 'week':
        return 7 * 24 * 60 * 60 * 1000;
      default:
        return 60 * 60 * 1000;
    }
  }

  // Export performance data
  exportMetrics(format: 'json' | 'csv' = 'json'): string {
    if (format === 'json') {
      return JSON.stringify({
        metrics: this.metrics,
        systemMetrics: this.systemMetrics,
      }, null, 2);
    } else {
      // CSV format for metrics
      const headers = 'Timestamp,Endpoint,Method,ResponseTime,StatusCode,MemoryUsage,UserId\n';
      const rows = this.metrics.map(m => 
        `${m.timestamp.toISOString()},${m.endpoint},${m.method},${m.responseTime},${m.statusCode},${m.memoryUsage},${m.userId || ''}`
      ).join('\n');
      
      return headers + rows;
    }
  }
}

// Export singleton instance
export const performanceMonitoringService = new PerformanceMonitoringService();

// Auto-start monitoring
performanceMonitoringService.startMonitoring(); 