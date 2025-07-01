'use client';

import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/lib/redux/hooks';
import { fetchProducts, fetchCategories } from '@/lib/redux/features/productSlice';
import Link from 'next/link';

interface ReportData {
  totalProducts: number;
  totalCategories: number;
  totalValue: number;
  lowStockCount: number;
  outOfStockCount: number;
  categoryBreakdown: { name: string; count: number; value: number }[];
  stockStatusBreakdown: { status: string; count: number; percentage: number }[];
  topValueProducts: any[];
  topStockProducts: any[];
}

export default function ReportsPage() {
  const dispatch = useAppDispatch();
  const { products, categories, loading } = useAppSelector((state) => state.product);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [selectedTimeframe, setSelectedTimeframe] = useState('all');

  useEffect(() => {
    dispatch(fetchProducts({}));
    dispatch(fetchCategories());
  }, [dispatch]);

  useEffect(() => {
    if (products.length > 0 && categories.length > 0) {
      generateReportData();
    }
  }, [products, categories]);

  const generateReportData = () => {
    const totalProducts = products.length;
    const totalCategories = categories.length;
    const totalValue = products.reduce((sum, product) => sum + (product.quantity * product.cost), 0);
    
    const lowStockCount = products.filter(p => p.quantity <= p.minQuantity && p.quantity > 0).length;
    const outOfStockCount = products.filter(p => p.quantity === 0).length;
    
    // Category breakdown
    const categoryBreakdown = categories.map(category => {
      const categoryProducts = products.filter(p => p.categoryId === category.id);
      const categoryValue = categoryProducts.reduce((sum, p) => sum + (p.quantity * p.cost), 0);
      return {
        name: category.name,
        count: categoryProducts.length,
        value: categoryValue
      };
    });

    // Stock status breakdown
    const inStockCount = products.filter(p => p.quantity > p.minQuantity).length;
    const stockStatusBreakdown = [
      {
        status: 'In Stock',
        count: inStockCount,
        percentage: (inStockCount / totalProducts) * 100
      },
      {
        status: 'Low Stock',
        count: lowStockCount,
        percentage: (lowStockCount / totalProducts) * 100
      },
      {
        status: 'Out of Stock',
        count: outOfStockCount,
        percentage: (outOfStockCount / totalProducts) * 100
      }
    ];

    // Top products by value
    const topValueProducts = [...products]
      .sort((a, b) => (b.quantity * b.cost) - (a.quantity * a.cost))
      .slice(0, 10);

    // Top products by stock quantity
    const topStockProducts = [...products]
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    setReportData({
      totalProducts,
      totalCategories,
      totalValue,
      lowStockCount,
      outOfStockCount,
      categoryBreakdown,
      stockStatusBreakdown,
      topValueProducts,
      topStockProducts
    });
  };

  const exportToCSV = () => {
    if (!reportData) return;

    const csvContent = [
      'Product Report',
      '',
      'Summary',
      `Total Products,${reportData.totalProducts}`,
      `Total Categories,${reportData.totalCategories}`,
      `Total Inventory Value,$${reportData.totalValue.toFixed(2)}`,
      `Low Stock Items,${reportData.lowStockCount}`,
      `Out of Stock Items,${reportData.outOfStockCount}`,
      '',
      'Category Breakdown',
      'Category,Product Count,Total Value',
      ...reportData.categoryBreakdown.map(cat => 
        `${cat.name},${cat.count},$${cat.value.toFixed(2)}`
      ),
      '',
      'Product Details',
      'Name,SKU,Category,Quantity,Cost,Price,Total Value',
      ...products.map(product => 
        `${product.name},${product.sku},${product.category?.name || 'N/A'},${product.quantity},$${product.cost},$${product.price},$${(product.quantity * product.cost).toFixed(2)}`
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading || !reportData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Inventory Reports</h1>
          <p className="text-gray-600">Analytics and insights for your inventory</p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={exportToCSV}
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
          >
            Export CSV
          </button>
          <Link
            href="/dashboard"
            className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-sm font-medium text-gray-500">Total Products</h3>
          <p className="text-2xl font-bold text-gray-900">{reportData.totalProducts}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-sm font-medium text-gray-500">Categories</h3>
          <p className="text-2xl font-bold text-gray-900">{reportData.totalCategories}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-sm font-medium text-gray-500">Total Value</h3>
          <p className="text-2xl font-bold text-green-600">${reportData.totalValue.toFixed(2)}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-sm font-medium text-gray-500">Low Stock</h3>
          <p className="text-2xl font-bold text-orange-600">{reportData.lowStockCount}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-sm font-medium text-gray-500">Out of Stock</h3>
          <p className="text-2xl font-bold text-red-600">{reportData.outOfStockCount}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Category Breakdown */}
        <div className="bg-white p-6 rounded-lg shadow border">
          <h2 className="text-xl font-semibold mb-4">Category Breakdown</h2>
          <div className="space-y-3">
            {reportData.categoryBreakdown.map((category, index) => (
              <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                <div>
                  <p className="font-medium">{category.name}</p>
                  <p className="text-sm text-gray-600">{category.count} products</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">${category.value.toFixed(2)}</p>
                  <p className="text-sm text-gray-600">
                    {((category.value / reportData.totalValue) * 100).toFixed(1)}%
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Stock Status */}
        <div className="bg-white p-6 rounded-lg shadow border">
          <h2 className="text-xl font-semibold mb-4">Stock Status Distribution</h2>
          <div className="space-y-4">
            {reportData.stockStatusBreakdown.map((status, index) => (
              <div key={index} className="space-y-2">
                <div className="flex justify-between">
                  <span className="font-medium">{status.status}</span>
                  <span>{status.count} ({status.percentage.toFixed(1)}%)</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      status.status === 'In Stock' ? 'bg-green-500' :
                      status.status === 'Low Stock' ? 'bg-orange-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${status.percentage}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Top Products by Value */}
        <div className="bg-white p-6 rounded-lg shadow border">
          <h2 className="text-xl font-semibold mb-4">Top Products by Value</h2>
          <div className="space-y-3">
            {reportData.topValueProducts.map((product, index) => (
              <div key={product.id} className="flex justify-between items-center p-3 hover:bg-gray-50 rounded">
                <div className="flex items-center space-x-3">
                  <span className="w-6 h-6 bg-blue-500 text-white text-xs rounded-full flex items-center justify-center">
                    {index + 1}
                  </span>
                  <div>
                    <p className="font-medium">{product.name}</p>
                    <p className="text-sm text-gray-600">Qty: {product.quantity}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold">${(product.quantity * product.cost).toFixed(2)}</p>
                  <p className="text-sm text-gray-600">${product.cost}/unit</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Products by Stock */}
        <div className="bg-white p-6 rounded-lg shadow border">
          <h2 className="text-xl font-semibold mb-4">Top Products by Stock Quantity</h2>
          <div className="space-y-3">
            {reportData.topStockProducts.map((product, index) => (
              <div key={product.id} className="flex justify-between items-center p-3 hover:bg-gray-50 rounded">
                <div className="flex items-center space-x-3">
                  <span className="w-6 h-6 bg-green-500 text-white text-xs rounded-full flex items-center justify-center">
                    {index + 1}
                  </span>
                  <div>
                    <p className="font-medium">{product.name}</p>
                    <p className="text-sm text-gray-600">{product.category?.name}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{product.quantity} units</p>
                  <p className="text-sm text-gray-600">Min: {product.minQuantity}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
} 