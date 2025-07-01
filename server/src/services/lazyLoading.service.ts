import { logger } from '../utils/logger';
import { cacheService } from './cache.service';

export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filters?: Record<string, any>;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
  metadata?: {
    loadTime: number;
    cacheHit: boolean;
    filters: Record<string, any>;
  };
}

export interface LazyLoadConfig {
  defaultPageSize: number;
  maxPageSize: number;
  cacheEnabled: boolean;
  cacheTimeout: number; // in seconds
  preloadEnabled: boolean;
  preloadPages: number;
}

class LazyLoadingService {
  private config: LazyLoadConfig = {
    defaultPageSize: 20,
    maxPageSize: 100,
    cacheEnabled: true,
    cacheTimeout: 300, // 5 minutes
    preloadEnabled: true,
    preloadPages: 2,
  };

  private loaders: Map<string, Function> = new Map();
  private preloadQueue: Map<string, Promise<any>> = new Map();

  // Register a lazy loader function
  registerLoader(key: string, loaderFn: Function): void {
    this.loaders.set(key, loaderFn);
    logger.debug('Lazy loader registered', { key });
  }

  // Generic paginated data loader
  async loadPaginated<T>(
    loaderKey: string,
    options: PaginationOptions,
    context?: any
  ): Promise<PaginatedResult<T>> {
    const startTime = Date.now();
    
    // Validate pagination options
    const validatedOptions = this.validatePaginationOptions(options);
    
    // Generate cache key
    const cacheKey = this.generateCacheKey(loaderKey, validatedOptions, context);
    
    let cacheHit = false;
    let result: PaginatedResult<T>;

    // Try to get from cache first
    if (this.config.cacheEnabled) {
      const cachedResult = await cacheService.get<PaginatedResult<T>>(cacheKey);
      if (cachedResult) {
        cacheHit = true;
        result = cachedResult;
        logger.debug('Lazy load cache hit', { loaderKey, cacheKey });
      }
    }

    // Load from source if not cached
    if (!cacheHit) {
      const loader = this.loaders.get(loaderKey);
      if (!loader) {
        throw new Error(`Loader not found: ${loaderKey}`);
      }

      try {
        const data = await loader(validatedOptions, context);
        result = this.formatPaginatedResult(data, validatedOptions);
        
        // Cache the result
        if (this.config.cacheEnabled) {
          await cacheService.set(cacheKey, result, this.config.cacheTimeout);
        }

        logger.debug('Lazy load from source', { loaderKey, recordCount: result.data.length });
      } catch (error) {
        logger.error('Lazy load failed', {
          loaderKey,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    }

    // Add metadata
    const loadTime = Date.now() - startTime;
    result.metadata = {
      loadTime,
      cacheHit,
      filters: validatedOptions.filters || {},
    };

    // Trigger preloading if enabled
    if (this.config.preloadEnabled && !cacheHit) {
      this.schedulePreload(loaderKey, validatedOptions, context);
    }

    return result;
  }

  // Load single item with lazy loading
  async loadItem<T>(
    loaderKey: string,
    itemId: string | number,
    context?: any
  ): Promise<T | null> {
    const cacheKey = `${loaderKey}:item:${itemId}`;
    
    // Try cache first
    if (this.config.cacheEnabled) {
      const cachedItem = await cacheService.get<T>(cacheKey);
      if (cachedItem) {
        logger.debug('Item cache hit', { loaderKey, itemId });
        return cachedItem;
      }
    }

    // Load from source
    const loader = this.loaders.get(loaderKey);
    if (!loader) {
      throw new Error(`Loader not found: ${loaderKey}`);
    }

    try {
      const item = await loader({ itemId }, context);
      
      // Cache the item
      if (this.config.cacheEnabled && item) {
        await cacheService.set(cacheKey, item, this.config.cacheTimeout);
      }

      return item;
    } catch (error) {
      logger.error('Item lazy load failed', {
        loaderKey,
        itemId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  // Batch load multiple items
  async loadBatch<T>(
    loaderKey: string,
    itemIds: (string | number)[],
    context?: any
  ): Promise<Map<string | number, T>> {
    const results = new Map<string | number, T>();
    const uncachedIds: (string | number)[] = [];

    // Check cache for each item
    if (this.config.cacheEnabled) {
      for (const itemId of itemIds) {
        const cacheKey = `${loaderKey}:item:${itemId}`;
        const cachedItem = await cacheService.get<T>(cacheKey);
        if (cachedItem) {
          results.set(itemId, cachedItem);
        } else {
          uncachedIds.push(itemId);
        }
      }
    } else {
      uncachedIds.push(...itemIds);
    }

    // Load uncached items
    if (uncachedIds.length > 0) {
      const loader = this.loaders.get(loaderKey);
      if (!loader) {
        throw new Error(`Loader not found: ${loaderKey}`);
      }

      try {
        const batchResults = await loader({ itemIds: uncachedIds }, context);
        
        // Process batch results
        for (const [itemId, item] of Object.entries(batchResults)) {
          results.set(itemId, item as T);
          
          // Cache individual items
          if (this.config.cacheEnabled) {
            const cacheKey = `${loaderKey}:item:${itemId}`;
            await cacheService.set(cacheKey, item, this.config.cacheTimeout);
          }
        }
      } catch (error) {
        logger.error('Batch lazy load failed', {
          loaderKey,
          itemIds: uncachedIds,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    }

    logger.debug('Batch load completed', {
      loaderKey,
      totalItems: itemIds.length,
      cachedItems: itemIds.length - uncachedIds.length,
      loadedItems: uncachedIds.length,
    });

    return results;
  }

  // Infinite scroll helper
  async loadNextPage<T>(
    loaderKey: string,
    currentOptions: PaginationOptions,
    context?: any
  ): Promise<PaginatedResult<T> | null> {
    const nextPageOptions = {
      ...currentOptions,
      page: currentOptions.page + 1,
    };

    try {
      const result = await this.loadPaginated<T>(loaderKey, nextPageOptions, context);
      return result.data.length > 0 ? result : null;
    } catch (error) {
      logger.error('Next page load failed', {
        loaderKey,
        currentPage: currentOptions.page,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  // Search with debouncing and caching
  async searchWithDebounce<T>(
    loaderKey: string,
    query: string,
    options: Partial<PaginationOptions> = {},
    debounceMs: number = 300
  ): Promise<PaginatedResult<T>> {
    const searchKey = `search:${loaderKey}:${query}`;
    
    // Clear existing search timeout
    const existingTimeout = this.preloadQueue.get(searchKey);
    if (existingTimeout) {
      // Cancel existing timeout if it's a Promise with a cancel method
      this.preloadQueue.delete(searchKey);
    }

    // Create debounced search
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(async () => {
        try {
          const searchOptions: PaginationOptions = {
            page: 1,
            limit: this.config.defaultPageSize,
            ...options,
            filters: {
              ...options.filters,
              search: query,
            },
          };

          const result = await this.loadPaginated<T>(loaderKey, searchOptions);
          this.preloadQueue.delete(searchKey);
          resolve(result);
        } catch (error) {
          this.preloadQueue.delete(searchKey);
          reject(error);
        }
      }, debounceMs);

      // Store timeout reference (simplified for this example)
      this.preloadQueue.set(searchKey, Promise.resolve(timeoutId));
    });
  }

  // Preload adjacent pages
  private async schedulePreload(
    loaderKey: string,
    currentOptions: PaginationOptions,
    context?: any
  ): Promise<void> {
    if (!this.config.preloadEnabled) {
      return;
    }

    const preloadPages: number[] = [];
    
    // Preload next pages
    for (let i = 1; i <= this.config.preloadPages; i++) {
      preloadPages.push(currentOptions.page + i);
    }

    // Preload previous pages
    for (let i = 1; i <= this.config.preloadPages; i++) {
      const prevPage = currentOptions.page - i;
      if (prevPage > 0) {
        preloadPages.push(prevPage);
      }
    }

    // Execute preloads in background
    for (const page of preloadPages) {
      const preloadOptions = { ...currentOptions, page };
      const preloadKey = this.generateCacheKey(loaderKey, preloadOptions, context);
      
      // Skip if already preloading or cached
      if (this.preloadQueue.has(preloadKey)) {
        continue;
      }

      // Check if already cached
      if (this.config.cacheEnabled) {
        const cached = await cacheService.get(preloadKey);
        if (cached) {
          continue;
        }
      }

      // Start preload
      const preloadPromise = this.executePreload(loaderKey, preloadOptions, context, preloadKey);
      this.preloadQueue.set(preloadKey, preloadPromise);
    }
  }

  // Execute preload operation
  private async executePreload(
    loaderKey: string,
    options: PaginationOptions,
    context: any,
    preloadKey: string
  ): Promise<void> {
    try {
      const loader = this.loaders.get(loaderKey);
      if (!loader) {
        return;
      }

      const data = await loader(options, context);
      const result = this.formatPaginatedResult(data, options);
      
      // Cache preloaded data
      if (this.config.cacheEnabled) {
        await cacheService.set(preloadKey, result, this.config.cacheTimeout);
      }

      logger.debug('Preload completed', { loaderKey, page: options.page });
    } catch (error) {
      logger.warn('Preload failed', {
        loaderKey,
        page: options.page,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.preloadQueue.delete(preloadKey);
    }
  }

  // Validate and normalize pagination options
  private validatePaginationOptions(options: PaginationOptions): PaginationOptions {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(
      this.config.maxPageSize,
      Math.max(1, options.limit || this.config.defaultPageSize)
    );

    return {
      ...options,
      page,
      limit,
    };
  }

  // Generate cache key for pagination options
  private generateCacheKey(
    loaderKey: string,
    options: PaginationOptions,
    context?: any
  ): string {
    const contextHash = context ? JSON.stringify(context) : '';
    const optionsHash = JSON.stringify(options);
    return `lazy:${loaderKey}:${Buffer.from(optionsHash + contextHash).toString('base64')}`;
  }

  // Format raw data into paginated result
  private formatPaginatedResult<T>(
    data: { items: T[]; total: number },
    options: PaginationOptions
  ): PaginatedResult<T> {
    const totalPages = Math.ceil(data.total / options.limit);
    
    return {
      data: data.items,
      pagination: {
        page: options.page,
        limit: options.limit,
        total: data.total,
        totalPages,
        hasNextPage: options.page < totalPages,
        hasPrevPage: options.page > 1,
      },
    };
  }

  // Clear cache for specific loader
  async clearCache(loaderKey: string): Promise<void> {
    await cacheService.deleteByPattern(`lazy:${loaderKey}:*`);
    logger.info('Lazy loading cache cleared', { loaderKey });
  }

  // Get configuration
  getConfig(): LazyLoadConfig {
    return { ...this.config };
  }

  // Update configuration
  updateConfig(newConfig: Partial<LazyLoadConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('Lazy loading configuration updated', { config: this.config });
  }

  // Get loading statistics
  getStats(): {
    registeredLoaders: number;
    activePreloads: number;
    cacheHitRate: number;
    averageLoadTime: number;
  } {
    // This would require more sophisticated tracking in a real implementation
    return {
      registeredLoaders: this.loaders.size,
      activePreloads: this.preloadQueue.size,
      cacheHitRate: 0.85, // Placeholder
      averageLoadTime: 150, // Placeholder
    };
  }

  // Helper for implementing infinite scroll on frontend
  createInfiniteScrollHelper<T>(
    loaderKey: string,
    initialOptions: PaginationOptions,
    context?: any
  ) {
    let currentPage = initialOptions.page;
    let hasMore = true;
    let loading = false;

    return {
      async loadMore(): Promise<T[]> {
        if (!hasMore || loading) {
          return [];
        }

        loading = true;
        try {
          const result = await this.loadPaginated<T>(
            loaderKey,
            { ...initialOptions, page: currentPage },
            context
          );

          currentPage++;
          hasMore = result.pagination.hasNextPage;
          loading = false;

          return result.data;
        } catch (error) {
          loading = false;
          throw error;
        }
      },

      reset() {
        currentPage = initialOptions.page;
        hasMore = true;
        loading = false;
      },

      get isLoading() {
        return loading;
      },

      get hasMoreData() {
        return hasMore;
      },
    };
  }

  // Express middleware for automatic pagination
  middleware() {
    return (req: any, res: any, next: any) => {
      // Parse pagination parameters from query
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || this.config.defaultPageSize;
      const sortBy = req.query.sortBy as string;
      const sortOrder = (req.query.sortOrder as 'asc' | 'desc') || 'asc';

      // Parse filters
      const filters: Record<string, any> = {};
      for (const [key, value] of Object.entries(req.query)) {
        if (!['page', 'limit', 'sortBy', 'sortOrder'].includes(key)) {
          filters[key] = value;
        }
      }

      // Add pagination options to request
      req.pagination = this.validatePaginationOptions({
        page,
        limit,
        sortBy,
        sortOrder,
        filters: Object.keys(filters).length > 0 ? filters : undefined,
      });

      next();
    };
  }
}

// Export singleton instance
export const lazyLoadingService = new LazyLoadingService(); 