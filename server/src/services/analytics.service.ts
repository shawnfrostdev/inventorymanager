import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { socketService } from './socket.service';
import { cacheService } from './cache.service';

const prisma = new PrismaClient();

export interface KPIMetric {
  id: string;
  name: string;
  category: 'sales' | 'inventory' | 'financial' | 'customer' | 'operational';
  value: number;
  target?: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
  trendPercentage: number;
  lastUpdated: Date;
  description: string;
}

export interface SalesAnalytics {
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  conversionRate: number;
  topProducts: Array<{
    productId: string;
    productName: string;
    revenue: number;
    quantity: number;
    growth: number;
  }>;
  salesByPeriod: Array<{
    period: string;
    revenue: number;
    orders: number;
    customers: number;
  }>;
  seasonalTrends: Array<{
    month: string;
    revenue: number;
    growth: number;
  }>;
}

export interface InventoryAnalytics {
  totalProducts: number;
  totalStockValue: number;
  lowStockItems: number;
  stockTurnover: number;
  topMovingProducts: Array<{
    productId: string;
    productName: string;
    turnoverRate: number;
    averageStockLevel: number;
    daysOfInventory: number;
  }>;
  categoryPerformance: Array<{
    categoryId: string;
    categoryName: string;
    totalValue: number;
    turnoverRate: number;
    profitMargin: number;
  }>;
  stockAlerts: Array<{
    productId: string;
    productName: string;
    currentStock: number;
    reorderLevel: number;
    daysUntilStockout: number;
  }>;
}

export interface CustomerAnalytics {
  totalCustomers: number;
  activeCustomers: number;
  newCustomers: number;
  customerRetentionRate: number;
  customerLifetimeValue: number;
  customerSegments: Array<{
    segment: string;
    count: number;
    percentage: number;
    averageSpent: number;
  }>;
  topCustomers: Array<{
    customerId: string;
    customerName: string;
    totalSpent: number;
    orderCount: number;
    lastOrderDate: Date;
  }>;
  churnRisk: Array<{
    customerId: string;
    customerName: string;
    riskScore: number;
    daysSinceLastOrder: number;
  }>;
}

export interface TrendAnalysis {
  salesTrend: {
    direction: 'increasing' | 'decreasing' | 'stable';
    strength: number;
    confidence: number;
    prediction: number;
  };
  inventoryTrend: {
    stockLevels: 'increasing' | 'decreasing' | 'stable';
    turnoverTrend: 'improving' | 'declining' | 'stable';
    optimizationScore: number;
  };
  customerTrend: {
    acquisitionRate: 'increasing' | 'decreasing' | 'stable';
    retentionRate: 'improving' | 'declining' | 'stable';
    satisfactionScore: number;
  };
}

export interface ForecastData {
  period: string;
  type: 'sales' | 'inventory' | 'demand';
  predictions: Array<{
    date: Date;
    value: number;
    confidence: number;
    upperBound: number;
    lowerBound: number;
  }>;
  accuracy: number;
  method: string;
  factors: string[];
}

class AnalyticsService {
  private kpiCache: Map<string, KPIMetric> = new Map();
  private analyticsCache: Map<string, any> = new Map();
  private updateInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startPeriodicUpdates();
    this.initializeKPIs();
  }

  // Initialize core KPIs
  private async initializeKPIs(): Promise<void> {
    const kpis: KPIMetric[] = [
      {
        id: 'total_revenue',
        name: 'Total Revenue',
        category: 'financial',
        value: 0,
        target: 100000,
        unit: 'currency',
        trend: 'stable',
        trendPercentage: 0,
        lastUpdated: new Date(),
        description: 'Total revenue generated from all sales'
      },
      {
        id: 'order_count',
        name: 'Total Orders',
        category: 'sales',
        value: 0,
        target: 1000,
        unit: 'count',
        trend: 'stable',
        trendPercentage: 0,
        lastUpdated: new Date(),
        description: 'Total number of orders processed'
      },
      {
        id: 'customer_count',
        name: 'Active Customers',
        category: 'customer',
        value: 0,
        target: 500,
        unit: 'count',
        trend: 'stable',
        trendPercentage: 0,
        lastUpdated: new Date(),
        description: 'Number of active customers in the last 30 days'
      },
      {
        id: 'inventory_turnover',
        name: 'Inventory Turnover',
        category: 'inventory',
        value: 0,
        target: 12,
        unit: 'ratio',
        trend: 'stable',
        trendPercentage: 0,
        lastUpdated: new Date(),
        description: 'How many times inventory is sold and replaced per year'
      },
      {
        id: 'avg_order_value',
        name: 'Average Order Value',
        category: 'sales',
        value: 0,
        target: 150,
        unit: 'currency',
        trend: 'stable',
        trendPercentage: 0,
        lastUpdated: new Date(),
        description: 'Average value of each order'
      }
    ];

    for (const kpi of kpis) {
      this.kpiCache.set(kpi.id, kpi);
    }

    await this.updateAllKPIs();
    logger.info('KPIs initialized', { count: kpis.length });
  }

  // Get comprehensive sales analytics
  async getSalesAnalytics(period: 'week' | 'month' | 'quarter' | 'year' = 'month'): Promise<SalesAnalytics> {
    const cacheKey = `sales_analytics_${period}`;
    const cached = await cacheService.get<SalesAnalytics>(cacheKey);
    if (cached) {
      return cached;
    }

    const dateRange = this.getPeriodRange(period);
    
    // Get orders within period
    const orders = await prisma.order.findMany({
      where: {
        createdAt: {
          gte: dateRange.start,
          lte: dateRange.end
        }
      },
      include: {
        orderItems: {
          include: {
            product: true
          }
        },
        customer: true
      }
    });

    // Calculate basic metrics
    const totalRevenue = orders.reduce((sum, order) => sum + Number(order.total), 0);
    const totalOrders = orders.length;
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const uniqueCustomers = new Set(orders.map(o => o.customerId)).size;
    const conversionRate = uniqueCustomers > 0 ? (totalOrders / uniqueCustomers) * 100 : 0;

    // Top products analysis
    const productSales = new Map<string, { productId: string; productName: string; revenue: number; quantity: number }>();
    
    orders.forEach(order => {
      order.orderItems.forEach(item => {
        const key = item.productId;
        if (!productSales.has(key)) {
          productSales.set(key, {
            productId: item.productId,
            productName: item.product.name,
            revenue: 0,
            quantity: 0
          });
        }
        const data = productSales.get(key)!;
        data.revenue += item.quantity * Number(item.price);
        data.quantity += item.quantity;
      });
    });

    // Get previous period for growth calculation
    const prevPeriodRange = this.getPreviousPeriodRange(period);
    const prevOrders = await prisma.order.findMany({
      where: {
        createdAt: {
          gte: prevPeriodRange.start,
          lte: prevPeriodRange.end
        }
      },
      include: {
        orderItems: {
          include: {
            product: true
          }
        }
      }
    });

    const prevProductSales = new Map<string, number>();
    prevOrders.forEach(order => {
      order.orderItems.forEach(item => {
        const current = prevProductSales.get(item.productId) || 0;
        prevProductSales.set(item.productId, current + (item.quantity * Number(item.price)));
      });
    });

    const topProducts = Array.from(productSales.values())
      .map(product => {
        const prevRevenue = prevProductSales.get(product.productId) || 0;
        const growth = prevRevenue > 0 ? ((product.revenue - prevRevenue) / prevRevenue) * 100 : 100;
        return { ...product, growth };
      })
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Sales by period (daily breakdown)
    const salesByPeriod = this.groupOrdersByDay(orders);

    // Seasonal trends (monthly analysis for the last year)
    const seasonalTrends = await this.getSeasonalTrends();

    const analytics: SalesAnalytics = {
      totalRevenue,
      totalOrders,
      averageOrderValue,
      conversionRate,
      topProducts,
      salesByPeriod,
      seasonalTrends
    };

    // Cache for 30 minutes
    await cacheService.set(cacheKey, analytics, 1800);

    logger.info('Sales analytics generated', {
      period,
      totalRevenue,
      totalOrders,
      topProductsCount: topProducts.length
    });

    return analytics;
  }

  // Get inventory analytics
  async getInventoryAnalytics(): Promise<InventoryAnalytics> {
    const cacheKey = 'inventory_analytics';
    const cached = await cacheService.get<InventoryAnalytics>(cacheKey);
    if (cached) {
      return cached;
    }

    // Get all products with stock information
    const products = await prisma.product.findMany({
      include: {
        category: true,
        productStocks: {
          include: {
            location: true
          }
        },
        orderItems: {
          where: {
            order: {
              createdAt: {
                gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) // Last year
              }
            }
          },
          include: {
            order: true
          }
        }
      }
    });

    const totalProducts = products.length;
    let totalStockValue = 0;
    let lowStockItems = 0;

    const topMovingProducts: any[] = [];
    const categoryPerformance = new Map<string, any>();
    const stockAlerts: any[] = [];

    products.forEach(product => {
      const totalStock = product.productStocks.reduce((sum, stock) => sum + stock.quantity, 0);
      const stockValue = totalStock * Number(product.price);
      totalStockValue += stockValue;

      // Check low stock
      if (totalStock <= (product.reorderLevel || 0)) {
        lowStockItems++;
        
        // Calculate days until stockout
        const avgDailyUsage = this.calculateDailyUsage(product.orderItems);
        const daysUntilStockout = avgDailyUsage > 0 ? Math.floor(totalStock / avgDailyUsage) : 999;
        
        stockAlerts.push({
          productId: product.id,
          productName: product.name,
          currentStock: totalStock,
          reorderLevel: product.reorderLevel || 0,
          daysUntilStockout
        });
      }

      // Calculate turnover rate
      const soldQuantity = product.orderItems.reduce((sum, item) => sum + item.quantity, 0);
      const avgStockLevel = totalStock; // Simplified - could calculate average over time
      const turnoverRate = avgStockLevel > 0 ? soldQuantity / avgStockLevel : 0;
      const daysOfInventory = turnoverRate > 0 ? 365 / turnoverRate : 999;

      if (soldQuantity > 0) {
        topMovingProducts.push({
          productId: product.id,
          productName: product.name,
          turnoverRate,
          averageStockLevel: avgStockLevel,
          daysOfInventory
        });
      }

      // Category performance
      if (product.category) {
        const categoryId = product.category.id;
        if (!categoryPerformance.has(categoryId)) {
          categoryPerformance.set(categoryId, {
            categoryId,
            categoryName: product.category.name,
            totalValue: 0,
            totalCost: 0,
            revenue: 0,
            items: 0
          });
        }

        const categoryData = categoryPerformance.get(categoryId)!;
        categoryData.totalValue += stockValue;
        categoryData.totalCost += totalStock * Number(product.costPrice || 0);
        categoryData.revenue += product.orderItems.reduce((sum, item) => 
          sum + (item.quantity * Number(item.price)), 0
        );
        categoryData.items++;
      }
    });

    // Sort and limit top moving products
    topMovingProducts.sort((a, b) => b.turnoverRate - a.turnoverRate);

    // Process category performance
    const categoryAnalytics = Array.from(categoryPerformance.values()).map(cat => ({
      categoryId: cat.categoryId,
      categoryName: cat.categoryName,
      totalValue: cat.totalValue,
      turnoverRate: cat.totalValue > 0 ? cat.revenue / cat.totalValue : 0,
      profitMargin: cat.revenue > 0 ? ((cat.revenue - cat.totalCost) / cat.revenue) * 100 : 0
    }));

    // Calculate overall stock turnover
    const totalCOGS = products.reduce((sum, product) => {
      return sum + product.orderItems.reduce((itemSum, item) => 
        itemSum + (item.quantity * Number(product.costPrice || product.price)), 0
      );
    }, 0);
    
    const stockTurnover = totalStockValue > 0 ? totalCOGS / totalStockValue : 0;

    const analytics: InventoryAnalytics = {
      totalProducts,
      totalStockValue,
      lowStockItems,
      stockTurnover,
      topMovingProducts: topMovingProducts.slice(0, 10),
      categoryPerformance: categoryAnalytics,
      stockAlerts: stockAlerts.sort((a, b) => a.daysUntilStockout - b.daysUntilStockout).slice(0, 10)
    };

    // Cache for 1 hour
    await cacheService.set(cacheKey, analytics, 3600);

    logger.info('Inventory analytics generated', {
      totalProducts,
      lowStockItems,
      stockTurnover
    });

    return analytics;
  }

  // Get customer analytics
  async getCustomerAnalytics(): Promise<CustomerAnalytics> {
    const cacheKey = 'customer_analytics';
    const cached = await cacheService.get<CustomerAnalytics>(cacheKey);
    if (cached) {
      return cached;
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    // Get all customers with their orders
    const customers = await prisma.user.findMany({
      where: {
        role: 'customer'
      },
      include: {
        orders: {
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    });

    const totalCustomers = customers.length;
    const activeCustomers = customers.filter(customer => 
      customer.orders.some(order => order.createdAt >= thirtyDaysAgo)
    ).length;

    const newCustomers = customers.filter(customer => 
      customer.createdAt >= thirtyDaysAgo
    ).length;

    // Calculate retention rate (customers who ordered in last 30 days and also in previous 30-90 days)
    const retentionCustomers = customers.filter(customer => {
      const recentOrders = customer.orders.filter(order => order.createdAt >= thirtyDaysAgo);
      const previousOrders = customer.orders.filter(order => 
        order.createdAt >= ninetyDaysAgo && order.createdAt < thirtyDaysAgo
      );
      return recentOrders.length > 0 && previousOrders.length > 0;
    }).length;

    const customersWithPreviousOrders = customers.filter(customer =>
      customer.orders.some(order => 
        order.createdAt >= ninetyDaysAgo && order.createdAt < thirtyDaysAgo
      )
    ).length;

    const customerRetentionRate = customersWithPreviousOrders > 0 
      ? (retentionCustomers / customersWithPreviousOrders) * 100 
      : 0;

    // Calculate customer lifetime value
    const totalRevenue = customers.reduce((sum, customer) => 
              sum + customer.orders.reduce((orderSum, order) => orderSum + Number(order.total), 0), 0
    );
    const customerLifetimeValue = totalCustomers > 0 ? totalRevenue / totalCustomers : 0;

    // Customer segmentation
    const segments = new Map<string, { count: number; totalSpent: number }>();
    
    customers.forEach(customer => {
      const totalSpent = customer.orders.reduce((sum, order) => sum + Number(order.totalAmount), 0);
      const orderCount = customer.orders.length;
      
      let segment = 'New';
      if (totalSpent > 10000) segment = 'VIP';
      else if (totalSpent > 5000) segment = 'Premium';
      else if (orderCount > 5) segment = 'Regular';
      else if (orderCount > 0) segment = 'Occasional';

      if (!segments.has(segment)) {
        segments.set(segment, { count: 0, totalSpent: 0 });
      }
      
      const segmentData = segments.get(segment)!;
      segmentData.count++;
      segmentData.totalSpent += totalSpent;
    });

    const customerSegments = Array.from(segments.entries()).map(([segment, data]) => ({
      segment,
      count: data.count,
      percentage: (data.count / totalCustomers) * 100,
      averageSpent: data.count > 0 ? data.totalSpent / data.count : 0
    }));

    // Top customers
    const topCustomers = customers
      .map(customer => {
        const totalSpent = customer.orders.reduce((sum, order) => sum + Number(order.total), 0);
        const orderCount = customer.orders.length;
        const lastOrder = customer.orders[0]; // Already ordered by createdAt desc
        
        return {
          customerId: customer.id,
          customerName: customer.name || customer.email,
          totalSpent,
          orderCount,
          lastOrderDate: lastOrder?.createdAt || customer.createdAt
        };
      })
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 10);

    // Churn risk analysis
    const churnRisk = customers
      .filter(customer => customer.orders.length > 0)
      .map(customer => {
        const lastOrder = customer.orders[0];
        const daysSinceLastOrder = Math.floor(
          (Date.now() - lastOrder.createdAt.getTime()) / (1000 * 60 * 60 * 24)
        );
        
        // Simple risk scoring: more days = higher risk
        let riskScore = 0;
        if (daysSinceLastOrder > 90) riskScore = 90;
        else if (daysSinceLastOrder > 60) riskScore = 70;
        else if (daysSinceLastOrder > 30) riskScore = 50;
        else if (daysSinceLastOrder > 14) riskScore = 30;

        return {
          customerId: customer.id,
          customerName: customer.name || customer.email,
          riskScore,
          daysSinceLastOrder
        };
      })
      .filter(customer => customer.riskScore > 0)
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 10);

    const analytics: CustomerAnalytics = {
      totalCustomers,
      activeCustomers,
      newCustomers,
      customerRetentionRate,
      customerLifetimeValue,
      customerSegments,
      topCustomers,
      churnRisk
    };

    // Cache for 2 hours
    await cacheService.set(cacheKey, analytics, 7200);

    logger.info('Customer analytics generated', {
      totalCustomers,
      activeCustomers,
      newCustomers,
      retentionRate: customerRetentionRate
    });

    return analytics;
  }

  // Generate trend analysis
  async getTrendAnalysis(): Promise<TrendAnalysis> {
    const cacheKey = 'trend_analysis';
    const cached = await cacheService.get<TrendAnalysis>(cacheKey);
    if (cached) {
      return cached;
    }

    // Get data for the last 12 months
    const monthlyData = await this.getMonthlyTrends();

    // Analyze sales trend
    const salesValues = monthlyData.map(m => m.revenue);
    const salesTrend = this.calculateTrend(salesValues);

    // Analyze inventory metrics
    const inventoryMetrics = await this.getMonthlyInventoryMetrics();
    const stockTurnoverValues = inventoryMetrics.map(m => m.turnover);
    const inventoryTrend = {
      stockLevels: this.getTrendDirection(inventoryMetrics.map(m => m.stockValue)),
      turnoverTrend: this.getTrendDirection(stockTurnoverValues) === 'increasing' ? 'improving' : 
                     this.getTrendDirection(stockTurnoverValues) === 'decreasing' ? 'declining' : 'stable',
      optimizationScore: this.calculateInventoryOptimizationScore(inventoryMetrics)
    };

    // Analyze customer trends
    const customerMetrics = await this.getMonthlyCustomerMetrics();
    const acquisitionValues = customerMetrics.map(m => m.newCustomers);
    const retentionValues = customerMetrics.map(m => m.retentionRate);

    const customerTrend = {
      acquisitionRate: this.getTrendDirection(acquisitionValues),
      retentionRate: this.getTrendDirection(retentionValues) === 'increasing' ? 'improving' :
                     this.getTrendDirection(retentionValues) === 'decreasing' ? 'declining' : 'stable',
      satisfactionScore: this.calculateCustomerSatisfactionScore(customerMetrics)
    };

    const analysis: TrendAnalysis = {
      salesTrend,
      inventoryTrend,
      customerTrend
    };

    // Cache for 4 hours
    await cacheService.set(cacheKey, analysis, 14400);

    logger.info('Trend analysis generated', {
      salesDirection: salesTrend.direction,
      inventoryOptimization: inventoryTrend.optimizationScore,
      customerSatisfaction: customerTrend.satisfactionScore
    });

    return analysis;
  }

  // Generate sales forecast
  async getSalesForecast(periods: number = 12): Promise<ForecastData> {
    const cacheKey = `sales_forecast_${periods}`;
    const cached = await cacheService.get<ForecastData>(cacheKey);
    if (cached) {
      return cached;
    }

    // Get historical data
    const historicalData = await this.getMonthlyTrends(24); // 24 months of data
    
    // Simple linear regression forecast
    const predictions = this.generateLinearForecast(
      historicalData.map(d => d.revenue),
      periods
    );

    const forecastData: ForecastData = {
      period: 'monthly',
      type: 'sales',
      predictions: predictions.map((value, index) => {
        const date = new Date();
        date.setMonth(date.getMonth() + index + 1);
        
        return {
          date,
          value,
          confidence: 0.75, // Simplified confidence score
          upperBound: value * 1.2,
          lowerBound: value * 0.8
        };
      }),
      accuracy: 0.78, // Historical accuracy placeholder
      method: 'Linear Regression',
      factors: ['Historical Sales', 'Seasonal Patterns', 'Growth Trend']
    };

    // Cache for 6 hours
    await cacheService.set(cacheKey, forecastData, 21600);

    logger.info('Sales forecast generated', {
      periods,
      method: forecastData.method,
      accuracy: forecastData.accuracy
    });

    return forecastData;
  }

  // Update all KPIs
  async updateAllKPIs(): Promise<void> {
    try {
      // Update revenue KPI
      const revenueResult = await prisma.order.aggregate({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          }
        },
        _sum: {
          total: true
        },
        _count: true
      });

      const totalRevenue = Number(revenueResult._sum.total || 0);
      const orderCount = revenueResult._count;

      // Get previous month's revenue for trend
      const prevRevenueResult = await prisma.order.aggregate({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
            lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          }
        },
        _sum: {
          total: true
        }
      });

      const prevRevenue = Number(prevRevenueResult._sum.total || 0);
      const revenueTrend = this.calculateKPITrend(totalRevenue, prevRevenue);

      // Update revenue KPI
      this.updateKPI('total_revenue', totalRevenue, revenueTrend.direction, revenueTrend.percentage);
      this.updateKPI('order_count', orderCount, revenueTrend.direction, revenueTrend.percentage);

      // Calculate average order value
      const avgOrderValue = orderCount > 0 ? totalRevenue / orderCount : 0;
      this.updateKPI('avg_order_value', avgOrderValue, revenueTrend.direction, revenueTrend.percentage);

      // Update customer count
      const activeCustomers = await prisma.user.count({
        where: {
          role: 'customer',
          orders: {
            some: {
              createdAt: {
                gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
              }
            }
          }
        }
      });

      this.updateKPI('customer_count', activeCustomers, 'stable', 0);

      // Calculate inventory turnover (simplified)
      const inventoryValue = await this.calculateInventoryValue();
      const cogs = totalRevenue * 0.7; // Simplified COGS estimation
      const turnover = inventoryValue > 0 ? (cogs * 12) / inventoryValue : 0; // Annualized

      this.updateKPI('inventory_turnover', turnover, 'stable', 0);

      // Send real-time KPI updates
      socketService.emitSystemAlert({
        type: 'info',
        message: 'KPIs updated',
        data: {
          totalRevenue,
          orderCount,
          activeCustomers,
          inventoryTurnover: turnover
        }
      });

      logger.info('All KPIs updated successfully', {
        totalRevenue,
        orderCount,
        activeCustomers,
        inventoryTurnover: turnover
      });

    } catch (error) {
      logger.error('Failed to update KPIs', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // Helper methods for calculations
  private calculateDailyUsage(orderItems: any[]): number {
    if (orderItems.length === 0) return 0;
    
    const totalQuantity = orderItems.reduce((sum, item) => sum + item.quantity, 0);
    const days = Math.max(1, Math.floor(
      (Date.now() - Math.min(...orderItems.map(item => item.order.createdAt.getTime()))) 
      / (1000 * 60 * 60 * 24)
    ));
    
    return totalQuantity / days;
  }

  private getPeriodRange(period: 'week' | 'month' | 'quarter' | 'year'): { start: Date; end: Date } {
    const now = new Date();
    const start = new Date(now);
    
    switch (period) {
      case 'week':
        start.setDate(now.getDate() - 7);
        break;
      case 'month':
        start.setMonth(now.getMonth() - 1);
        break;
      case 'quarter':
        start.setMonth(now.getMonth() - 3);
        break;
      case 'year':
        start.setFullYear(now.getFullYear() - 1);
        break;
    }
    
    return { start, end: now };
  }

  private getPreviousPeriodRange(period: 'week' | 'month' | 'quarter' | 'year'): { start: Date; end: Date } {
    const current = this.getPeriodRange(period);
    const duration = current.end.getTime() - current.start.getTime();
    
    return {
      start: new Date(current.start.getTime() - duration),
      end: current.start
    };
  }

  private groupOrdersByDay(orders: any[]): Array<{ period: string; revenue: number; orders: number; customers: number }> {
    const grouped = new Map<string, any>();
    
    orders.forEach(order => {
      const day = order.createdAt.toISOString().split('T')[0];
      
      if (!grouped.has(day)) {
        grouped.set(day, {
          period: day,
          revenue: 0,
          orders: 0,
          customers: new Set()
        });
      }
      
      const data = grouped.get(day)!;
      data.revenue += Number(order.total);
      data.orders++;
      if (order.customerId) {
        data.customers.add(order.customerId);
      }
    });
    
    return Array.from(grouped.values()).map(data => ({
      ...data,
      customers: data.customers.size
    }));
  }

  private async getSeasonalTrends(): Promise<Array<{ month: string; revenue: number; growth: number }>> {
    // Get last 12 months of data
    const monthlyData = await this.getMonthlyTrends(12);
    
    return monthlyData.map((current, index) => {
      const prevYear = monthlyData[index + 12];
      const growth = prevYear ? ((current.revenue - prevYear.revenue) / prevYear.revenue) * 100 : 0;
      
      return {
        month: current.month,
        revenue: current.revenue,
        growth
      };
    });
  }

  private async getMonthlyTrends(months: number = 12): Promise<Array<{ month: string; revenue: number; orders: number }>> {
    const monthlyData: Array<{ month: string; revenue: number; orders: number }> = [];
    
    for (let i = months - 1; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      
      const orders = await prisma.order.findMany({
        where: {
          createdAt: {
            gte: monthStart,
            lte: monthEnd
          }
        }
      });
      
      const revenue = orders.reduce((sum, order) => sum + Number(order.total), 0);
      
      monthlyData.push({
        month: date.toISOString().slice(0, 7), // YYYY-MM format
        revenue,
        orders: orders.length
      });
    }
    
    return monthlyData;
  }

  private async getMonthlyInventoryMetrics(): Promise<Array<{ month: string; stockValue: number; turnover: number }>> {
    // Simplified - in production, you'd track historical inventory values
    const months = 12;
    const metrics: Array<{ month: string; stockValue: number; turnover: number }> = [];
    
    for (let i = months - 1; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      
      // Mock data for demonstration
      metrics.push({
        month: date.toISOString().slice(0, 7),
        stockValue: 50000 + (Math.random() * 10000),
        turnover: 8 + (Math.random() * 4)
      });
    }
    
    return metrics;
  }

  private async getMonthlyCustomerMetrics(): Promise<Array<{ month: string; newCustomers: number; retentionRate: number }>> {
    const months = 12;
    const metrics: Array<{ month: string; newCustomers: number; retentionRate: number }> = [];
    
    for (let i = months - 1; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      
      const newCustomers = await prisma.user.count({
        where: {
          role: 'customer',
          createdAt: {
            gte: monthStart,
            lte: monthEnd
          }
        }
      });
      
      metrics.push({
        month: date.toISOString().slice(0, 7),
        newCustomers,
        retentionRate: 75 + (Math.random() * 20) // Mock retention rate
      });
    }
    
    return metrics;
  }

  private calculateTrend(values: number[]): { direction: 'increasing' | 'decreasing' | 'stable'; strength: number; confidence: number; prediction: number } {
    if (values.length < 2) {
      return { direction: 'stable', strength: 0, confidence: 0, prediction: values[0] || 0 };
    }
    
    // Simple linear regression
    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = values;
    
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    const direction = slope > 0.1 ? 'increasing' : slope < -0.1 ? 'decreasing' : 'stable';
    const strength = Math.abs(slope);
    const confidence = Math.min(0.95, Math.max(0.1, 1 - (Math.abs(slope) / (sumY / n))));
    const prediction = slope * n + intercept;
    
    return { direction, strength, confidence, prediction };
  }

  private getTrendDirection(values: number[]): 'increasing' | 'decreasing' | 'stable' {
    if (values.length < 2) return 'stable';
    
    const trend = this.calculateTrend(values);
    return trend.direction;
  }

  private calculateInventoryOptimizationScore(metrics: Array<{ stockValue: number; turnover: number }>): number {
    if (metrics.length === 0) return 50;
    
    const avgTurnover = metrics.reduce((sum, m) => sum + m.turnover, 0) / metrics.length;
    const turnoverScore = Math.min(100, (avgTurnover / 12) * 100); // Target 12 turns per year
    
    const stockStability = this.calculateStability(metrics.map(m => m.stockValue));
    const stabilityScore = (1 - stockStability) * 100;
    
    return Math.round((turnoverScore + stabilityScore) / 2);
  }

  private calculateCustomerSatisfactionScore(metrics: Array<{ retentionRate: number }>): number {
    if (metrics.length === 0) return 50;
    
    const avgRetention = metrics.reduce((sum, m) => sum + m.retentionRate, 0) / metrics.length;
    return Math.round(avgRetention);
  }

  private calculateStability(values: number[]): number {
    if (values.length < 2) return 0;
    
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    return stdDev / mean; // Coefficient of variation
  }

  private generateLinearForecast(historical: number[], periods: number): number[] {
    const trend = this.calculateTrend(historical);
    const lastValue = historical[historical.length - 1];
    
    return Array.from({ length: periods }, (_, i) => 
      lastValue + (trend.strength * (i + 1))
    );
  }

  private async calculateInventoryValue(): Promise<number> {
    const products = await prisma.product.findMany({
      include: {
        productStocks: true
      }
    });
    
    return products.reduce((sum, product) => {
      const totalStock = product.productStocks.reduce((stockSum, stock) => stockSum + stock.quantity, 0);
      return sum + (totalStock * Number(product.costPrice || product.price));
    }, 0);
  }

  private calculateKPITrend(current: number, previous: number): { direction: 'up' | 'down' | 'stable'; percentage: number } {
    if (previous === 0) {
      return { direction: current > 0 ? 'up' : 'stable', percentage: 0 };
    }
    
    const change = ((current - previous) / previous) * 100;
    
    if (Math.abs(change) < 1) {
      return { direction: 'stable', percentage: change };
    }
    
    return {
      direction: change > 0 ? 'up' : 'down',
      percentage: Math.abs(change)
    };
  }

  private updateKPI(kpiId: string, value: number, trend: 'up' | 'down' | 'stable', trendPercentage: number): void {
    const kpi = this.kpiCache.get(kpiId);
    if (kpi) {
      kpi.value = value;
      kpi.trend = trend;
      kpi.trendPercentage = trendPercentage;
      kpi.lastUpdated = new Date();
      this.kpiCache.set(kpiId, kpi);
    }
  }

  // Start periodic updates
  private startPeriodicUpdates(): void {
    // Update KPIs every hour
    this.updateInterval = setInterval(() => {
      this.updateAllKPIs();
    }, 60 * 60 * 1000);

    logger.info('Analytics periodic updates started');
  }

  // Stop periodic updates
  stopPeriodicUpdates(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  // Get all KPIs
  getAllKPIs(): KPIMetric[] {
    return Array.from(this.kpiCache.values());
  }

  // Get KPI by ID
  getKPI(kpiId: string): KPIMetric | null {
    return this.kpiCache.get(kpiId) || null;
  }

  // Get analytics dashboard data
  async getDashboardData(): Promise<{
    kpis: KPIMetric[];
    salesSummary: SalesAnalytics;
    inventorySummary: InventoryAnalytics;
    customerSummary: CustomerAnalytics;
    trends: TrendAnalysis;
  }> {
    const [salesSummary, inventorySummary, customerSummary, trends] = await Promise.all([
      this.getSalesAnalytics('month'),
      this.getInventoryAnalytics(),
      this.getCustomerAnalytics(),
      this.getTrendAnalysis()
    ]);

    return {
      kpis: this.getAllKPIs(),
      salesSummary,
      inventorySummary,
      customerSummary,
      trends
    };
  }
}

// Export singleton instance
export const analyticsService = new AnalyticsService(); 