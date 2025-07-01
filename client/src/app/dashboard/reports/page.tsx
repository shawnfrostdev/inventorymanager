'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '../../../lib/api';

interface KPIMetric {
  id: string;
  name: string;
  category: string;
  value: number;
  target?: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
  trendPercentage: number;
  lastUpdated: string;
  description: string;
}

interface SalesAnalytics {
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
}

interface InventoryAnalytics {
  totalProducts: number;
  totalStockValue: number;
  lowStockItems: number;
  stockTurnover: number;
  stockAlerts: Array<{
    productId: string;
    productName: string;
    currentStock: number;
    reorderLevel: number;
    daysUntilStockout: number;
  }>;
}

interface CustomerAnalytics {
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
}

export default function ReportsPage() {
  const [kpis, setKpis] = useState<KPIMetric[]>([]);
  const [salesAnalytics, setSalesAnalytics] = useState<SalesAnalytics | null>(null);
  const [inventoryAnalytics, setInventoryAnalytics] = useState<InventoryAnalytics | null>(null);
  const [customerAnalytics, setCustomerAnalytics] = useState<CustomerAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedPeriod, setSelectedPeriod] = useState('month');

  useEffect(() => {
    fetchDashboardData();
  }, [selectedPeriod]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      const [kpisResponse, salesResponse, inventoryResponse, customerResponse] = await Promise.all([
        apiClient.get('/api/reports/kpis/all'),
        apiClient.get(`/api/reports/analytics/sales?type=sales&period=${selectedPeriod}`),
        apiClient.get('/api/reports/analytics/inventory?type=inventory'),
        apiClient.get('/api/reports/analytics/customers?type=customer')
      ]);

      const [kpisData, salesData, inventoryData, customerData] = await Promise.all([
        kpisResponse.json(),
        salesResponse.json(),
        inventoryResponse.json(),
        customerResponse.json()
      ]);

      setKpis(kpisData.data || []);
      setSalesAnalytics(salesData.data);
      setInventoryAnalytics(inventoryData.data);
      setCustomerAnalytics(customerData.data);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const generateQuickReport = async (type: string) => {
    try {
      const response = await apiClient.get(`/api/reports/quick/${type}/${selectedPeriod}`);
      const reportData = await response.json();
      // You could open a new tab or download the report
      console.log('Report generated:', reportData);
      alert('Report generated successfully!');
    } catch (err) {
      alert('Failed to generate report: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US').format(value);
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return (
          <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17l9.2-9.2M17 17V7M17 17H7" />
          </svg>
        );
      case 'down':
        return (
          <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 7l-9.2 9.2M7 7v10M7 7h10" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen p-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Reports & Analytics</h1>
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen p-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Reports & Analytics</h1>
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <div className="mt-2 text-sm text-red-700">{error}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Reports & Analytics</h1>
          <p className="mt-1 text-sm text-gray-500">
            Comprehensive business intelligence and reporting dashboard
          </p>
        </div>
        
        <div className="mt-4 sm:mt-0 flex space-x-3">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
            <option value="year">This Year</option>
          </select>
          
          <button
            onClick={() => fetchDashboardData()}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'overview', name: 'Overview', icon: '📊' },
            { id: 'sales', name: 'Sales Analytics', icon: '💰' },
            { id: 'inventory', name: 'Inventory', icon: '📦' },
            { id: 'customers', name: 'Customers', icon: '👥' },
            { id: 'reports', name: 'Reports', icon: '📋' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {kpis.slice(0, 4).map((kpi) => (
              <div key={kpi.id} className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      {getTrendIcon(kpi.trend)}
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">{kpi.name}</dt>
                        <dd className="flex items-baseline">
                          <div className="text-2xl font-semibold text-gray-900">
                            {kpi.unit === 'currency' ? formatCurrency(kpi.value) : formatNumber(kpi.value)}
                          </div>
                          {kpi.trendPercentage !== 0 && (
                            <div className={`ml-2 flex items-baseline text-sm font-semibold ${
                              kpi.trend === 'up' ? 'text-green-600' : kpi.trend === 'down' ? 'text-red-600' : 'text-gray-600'
                            }`}>
                              {kpi.trendPercentage > 0 ? '+' : ''}{kpi.trendPercentage.toFixed(1)}%
                            </div>
                          )}
                        </dd>
                      </dl>
                    </div>
                  </div>
                  {kpi.target && (
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>Target: {kpi.unit === 'currency' ? formatCurrency(kpi.target) : formatNumber(kpi.target)}</span>
                        <span>{((kpi.value / kpi.target) * 100).toFixed(0)}%</span>
                      </div>
                      <div className="mt-1 w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${Math.min(100, (kpi.value / kpi.target) * 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Quick Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Sales Performance</h3>
              {salesAnalytics && (
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Total Revenue</span>
                    <span className="text-sm font-medium">{formatCurrency(salesAnalytics.totalRevenue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Total Orders</span>
                    <span className="text-sm font-medium">{formatNumber(salesAnalytics.totalOrders)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Average Order Value</span>
                    <span className="text-sm font-medium">{formatCurrency(salesAnalytics.averageOrderValue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Conversion Rate</span>
                    <span className="text-sm font-medium">{salesAnalytics.conversionRate.toFixed(1)}%</span>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Inventory Overview</h3>
              {inventoryAnalytics && (
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Total Products</span>
                    <span className="text-sm font-medium">{formatNumber(inventoryAnalytics.totalProducts)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Stock Value</span>
                    <span className="text-sm font-medium">{formatCurrency(inventoryAnalytics.totalStockValue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Low Stock Items</span>
                    <span className="text-sm font-medium text-red-600">{inventoryAnalytics.lowStockItems}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Turnover Rate</span>
                    <span className="text-sm font-medium">{inventoryAnalytics.stockTurnover.toFixed(1)}x</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sales Analytics Tab */}
      {activeTab === 'sales' && salesAnalytics && (
        <div className="space-y-6">
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Top Performing Products</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Growth</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {salesAnalytics.topProducts.map((product, index) => (
                    <tr key={product.productId}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {product.productName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatCurrency(product.revenue)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatNumber(product.quantity)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`font-medium ${
                          product.growth > 0 ? 'text-green-600' : product.growth < 0 ? 'text-red-600' : 'text-gray-600'
                        }`}>
                          {product.growth > 0 ? '+' : ''}{product.growth.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Inventory Tab */}
      {activeTab === 'inventory' && inventoryAnalytics && (
        <div className="space-y-6">
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Stock Alerts</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current Stock</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reorder Level</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Days Until Stockout</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {inventoryAnalytics.stockAlerts.map((alert) => (
                    <tr key={alert.productId}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {alert.productName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {alert.currentStock}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {alert.reorderLevel}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`font-medium ${
                          alert.daysUntilStockout <= 7 ? 'text-red-600' : alert.daysUntilStockout <= 30 ? 'text-yellow-600' : 'text-green-600'
                        }`}>
                          {alert.daysUntilStockout === 999 ? 'N/A' : `${alert.daysUntilStockout} days`}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Customers Tab */}
      {activeTab === 'customers' && customerAnalytics && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Customer Metrics</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Total Customers</span>
                  <span className="text-sm font-medium">{formatNumber(customerAnalytics.totalCustomers)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Active Customers</span>
                  <span className="text-sm font-medium">{formatNumber(customerAnalytics.activeCustomers)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">New Customers</span>
                  <span className="text-sm font-medium">{formatNumber(customerAnalytics.newCustomers)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Retention Rate</span>
                  <span className="text-sm font-medium">{customerAnalytics.customerRetentionRate.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Customer Lifetime Value</span>
                  <span className="text-sm font-medium">{formatCurrency(customerAnalytics.customerLifetimeValue)}</span>
                </div>
              </div>
            </div>

            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Customer Segments</h3>
              <div className="space-y-3">
                {customerAnalytics.customerSegments.map((segment) => (
                  <div key={segment.segment} className="flex items-center justify-between">
                    <div className="flex items-center">
                      <span className="text-sm font-medium text-gray-900">{segment.segment}</span>
                      <span className="ml-2 text-xs text-gray-500">({segment.percentage.toFixed(1)}%)</span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">{segment.count} customers</div>
                      <div className="text-xs text-gray-500">Avg: {formatCurrency(segment.averageSpent)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reports Tab */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Reports</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { id: 'sales-summary', name: 'Sales Summary', description: 'Comprehensive sales performance report' },
                { id: 'inventory-levels', name: 'Inventory Report', description: 'Current stock levels and alerts' },
                { id: 'customer-analysis', name: 'Customer Analysis', description: 'Customer behavior and segmentation' },
                { id: 'financial-performance', name: 'Financial Report', description: 'Revenue, costs, and profit analysis' }
              ].map((report) => (
                <div key={report.id} className="border border-gray-200 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-900">{report.name}</h4>
                  <p className="mt-1 text-xs text-gray-500">{report.description}</p>
                  <button
                    onClick={() => generateQuickReport(report.id)}
                    className="mt-3 w-full px-3 py-2 border border-transparent text-sm font-medium rounded-md text-blue-600 bg-blue-50 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    Generate Report
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 