import { logger } from '../utils/logger';

interface CacheItem {
  data: any;
  expiry: number;
  key: string;
}

class CacheService {
  private cache: Map<string, CacheItem> = new Map();
  private readonly defaultTTL = 5 * 60 * 1000; // 5 minutes in milliseconds

  // Set cache item with TTL
  set(key: string, data: any, ttl?: number): void {
    const expiry = Date.now() + (ttl || this.defaultTTL);
    
    this.cache.set(key, {
      data,
      expiry,
      key,
    });

    logger.debug('Cache set', { key, ttl: ttl || this.defaultTTL });
  }

  // Get cache item
  get(key: string): any | null {
    const item = this.cache.get(key);
    
    if (!item) {
      logger.debug('Cache miss', { key });
      return null;
    }

    // Check if item has expired
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      logger.debug('Cache expired', { key });
      return null;
    }

    logger.debug('Cache hit', { key });
    return item.data;
  }

  // Delete cache item
  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      logger.debug('Cache deleted', { key });
    }
    return deleted;
  }

  // Check if key exists and is not expired
  has(key: string): boolean {
    const item = this.cache.get(key);
    if (!item) return false;
    
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  // Clear all cache
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    logger.info('Cache cleared', { previousSize: size });
  }

  // Get cache statistics
  getStats(): {
    size: number;
    keys: string[];
    memoryUsage: string;
  } {
    const keys = Array.from(this.cache.keys());
    
    // Rough memory usage calculation
    const memoryUsage = keys.reduce((total, key) => {
      const item = this.cache.get(key);
      if (item) {
        return total + JSON.stringify(item).length;
      }
      return total;
    }, 0);

    return {
      size: this.cache.size,
      keys,
      memoryUsage: `${(memoryUsage / 1024).toFixed(2)} KB`,
    };
  }

  // Clean expired items
  cleanExpired(): number {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiry) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info('Cleaned expired cache items', { count: cleanedCount });
    }

    return cleanedCount;
  }

  // Cache wrapper for functions
  async wrap<T>(
    key: string,
    fn: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    // Try to get from cache first
    const cached = this.get(key);
    if (cached !== null) {
      return cached;
    }

    // Execute function and cache result
    try {
      const result = await fn();
      this.set(key, result, ttl);
      return result;
    } catch (error) {
      logger.error('Cache wrap function failed', { key, error });
      throw error;
    }
  }

  // Cache with tags for group invalidation
  setWithTags(key: string, data: any, tags: string[], ttl?: number): void {
    this.set(key, data, ttl);
    
    // Store tag mappings
    tags.forEach(tag => {
      const tagKey = `__tag__${tag}`;
      const taggedKeys = this.get(tagKey) || [];
      
      if (!taggedKeys.includes(key)) {
        taggedKeys.push(key);
        this.set(tagKey, taggedKeys, 24 * 60 * 60 * 1000); // Tags expire in 24 hours
      }
    });
  }

  // Invalidate all keys with specific tag
  invalidateTag(tag: string): number {
    const tagKey = `__tag__${tag}`;
    const taggedKeys = this.get(tagKey) || [];
    let invalidated = 0;

    taggedKeys.forEach((key: string) => {
      if (this.delete(key)) {
        invalidated++;
      }
    });

    // Remove the tag itself
    this.delete(tagKey);

    logger.info('Invalidated cache by tag', { tag, count: invalidated });
    return invalidated;
  }

  // Generate cache key for user-specific data
  userKey(userId: string, resource: string, id?: string): string {
    return id ? `user:${userId}:${resource}:${id}` : `user:${userId}:${resource}`;
  }

  // Generate cache key for global data
  globalKey(resource: string, id?: string): string {
    return id ? `global:${resource}:${id}` : `global:${resource}`;
  }

  // Cache frequently accessed product data
  async cacheProduct(productId: string, productData: any, ttl?: number): Promise<void> {
    const key = this.globalKey('product', productId);
    this.setWithTags(key, productData, ['products'], ttl);
  }

  // Cache user dashboard data
  async cacheDashboard(userId: string, dashboardData: any, ttl?: number): Promise<void> {
    const key = this.userKey(userId, 'dashboard');
    this.setWithTags(key, dashboardData, ['dashboard', `user-${userId}`], ttl);
  }

  // Cache order data
  async cacheOrder(userId: string, orderId: string, orderData: any, ttl?: number): Promise<void> {
    const key = this.userKey(userId, 'order', orderId);
    this.setWithTags(key, orderData, ['orders', `user-${userId}`], ttl);
  }

  // Cache invoice data
  async cacheInvoice(userId: string, invoiceId: string, invoiceData: any, ttl?: number): Promise<void> {
    const key = this.userKey(userId, 'invoice', invoiceId);
    this.setWithTags(key, invoiceData, ['invoices', `user-${userId}`], ttl);
  }

  // Invalidate user-specific cache
  invalidateUserCache(userId: string): number {
    return this.invalidateTag(`user-${userId}`);
  }

  // Invalidate product cache
  invalidateProductCache(): number {
    return this.invalidateTag('products');
  }

  // Start background cleanup timer
  startCleanupTimer(): void {
    setInterval(() => {
      this.cleanExpired();
    }, 10 * 60 * 1000); // Clean every 10 minutes

    logger.info('Cache cleanup timer started');
  }
}

// Export singleton instance
export const cacheService = new CacheService();

// Start cleanup on service initialization
cacheService.startCleanupTimer(); 