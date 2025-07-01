'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/lib/redux/hooks';
import { fetchProduct, updateProduct, deleteProduct } from '@/lib/redux/features/productSlice';
import Image from 'next/image';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import BarcodeGenerator from '@/components/products/BarcodeGenerator';

interface StockMovement {
  id: string;
  type: 'IN' | 'OUT' | 'ADJUSTMENT';
  quantity: number;
  reason?: string;
  createdAt: string;
  createdBy: {
    name: string;
  };
}

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { selectedProduct: currentProduct, loading } = useAppSelector((state) => state.product);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [showStockModal, setShowStockModal] = useState(false);
  const [stockAdjustment, setStockAdjustment] = useState({
    type: 'ADJUSTMENT' as 'IN' | 'OUT' | 'ADJUSTMENT',
    quantity: 0,
    reason: ''
  });
  const [movementsLoading, setMovementsLoading] = useState(false);

  const productId = params.id as string;

  useEffect(() => {
    if (productId) {
      dispatch(fetchProduct(productId));
      fetchStockMovements();
    }
  }, [dispatch, productId]);

  const fetchStockMovements = async () => {
    try {
      setMovementsLoading(true);
      const response = await apiClient.get(`/api/products/stock-movements/${productId}`);
      const data = await response.json();
      setStockMovements(data.data || []);
    } catch (error) {
      console.error('Failed to fetch stock movements:', error);
    } finally {
      setMovementsLoading(false);
    }
  };

  const handleStockAdjustment = async () => {
    try {
      const adjustmentData = {
        productId,
        type: stockAdjustment.type,
        quantity: stockAdjustment.type === 'OUT' ? -Math.abs(stockAdjustment.quantity) : Math.abs(stockAdjustment.quantity),
        reason: stockAdjustment.reason
      };

      await apiClient.post('/api/products/stock-movements', adjustmentData);
      
      // Refresh product data and stock movements
      dispatch(fetchProduct(productId));
      fetchStockMovements();
      
      // Reset form and close modal
      setStockAdjustment({ type: 'ADJUSTMENT', quantity: 0, reason: '' });
      setShowStockModal(false);
    } catch (error) {
      console.error('Failed to adjust stock:', error);
      alert('Failed to adjust stock. Please try again.');
    }
  };

  const handleDeleteProduct = async () => {
    if (confirm('Are you sure you want to delete this product? This action cannot be undone.')) {
      try {
        await dispatch(deleteProduct(productId)).unwrap();
        router.push('/dashboard/products');
      } catch (error) {
        console.error('Failed to delete product:', error);
        alert('Failed to delete product. Please try again.');
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!currentProduct) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Product not found</h1>
          <Link href="/dashboard/products" className="text-blue-500 hover:underline">
            Back to products
          </Link>
        </div>
      </div>
    );
  }

  const stockStatus = currentProduct.quantity === 0 ? 'out' : 
                     currentProduct.quantity <= currentProduct.minQuantity ? 'low' : 'normal';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <Link href="/dashboard/products" className="text-blue-500 hover:underline">
            ← Back to Products
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{currentProduct.name}</h1>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => setShowStockModal(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
          >
            Adjust Stock
          </button>
          <Link
            href={`/dashboard/products/${productId}/edit`}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Edit Product
          </Link>
          <button
            onClick={handleDeleteProduct}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Product Information */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                {currentProduct.imageUrl ? (
                  <div className="aspect-square relative border rounded">
                    <Image
                      src={currentProduct.imageUrl}
                      alt={currentProduct.name}
                      fill
                      className="object-cover rounded"
                    />
                  </div>
                ) : (
                  <div className="aspect-square bg-gray-200 flex items-center justify-center border rounded">
                    <span className="text-gray-400">No image</span>
                  </div>
                )}
              </div>
              
              <div className="space-y-4">
                <div>
                  <h2 className="text-xl font-semibold mb-4">Product Details</h2>
                  <div className="space-y-2">
                    <p><span className="font-medium">SKU:</span> {currentProduct.sku}</p>
                    <p><span className="font-medium">Barcode:</span> {currentProduct.barcode || 'N/A'}</p>
                    <p><span className="font-medium">Category:</span> {currentProduct.category?.name}</p>
                    <p><span className="font-medium">Price:</span> ${currentProduct.price.toFixed(2)}</p>
                    <p><span className="font-medium">Cost:</span> ${currentProduct.cost.toFixed(2)}</p>
                  </div>
                  
                  {currentProduct.barcode && (
                    <div className="mt-4">
                      <h3 className="font-medium mb-2">Barcode</h3>
                      <div className="p-3 bg-white border rounded">
                        <BarcodeGenerator 
                          value={currentProduct.barcode} 
                          width={1.5}
                          height={60}
                          fontSize={14}
                        />
                      </div>
                    </div>
                  )}
                </div>
                
                {currentProduct.description && (
                  <div>
                    <h3 className="font-medium mb-2">Description</h3>
                    <p className="text-gray-600">{currentProduct.description}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Stock Movements History */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Stock Movement History</h2>
              <button
                onClick={fetchStockMovements}
                className="text-blue-500 hover:text-blue-700"
              >
                Refresh
              </button>
            </div>
            
            {movementsLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gray-900 mx-auto"></div>
              </div>
            ) : stockMovements.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Date</th>
                      <th className="text-left py-2">Type</th>
                      <th className="text-left py-2">Quantity</th>
                      <th className="text-left py-2">Reason</th>
                      <th className="text-left py-2">User</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockMovements.map((movement) => (
                      <tr key={movement.id} className="border-b">
                        <td className="py-2">
                          {new Date(movement.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-2">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            movement.type === 'IN' ? 'bg-green-100 text-green-800' :
                            movement.type === 'OUT' ? 'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {movement.type}
                          </span>
                        </td>
                        <td className={`py-2 font-medium ${
                          movement.quantity > 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {movement.quantity > 0 ? '+' : ''}{movement.quantity}
                        </td>
                        <td className="py-2">{movement.reason || 'N/A'}</td>
                        <td className="py-2">{movement.createdBy?.name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">No stock movements recorded</p>
            )}
          </div>
        </div>

        {/* Stock Information Sidebar */}
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-xl font-semibold mb-4">Stock Information</h2>
            
            <div className="space-y-4">
              <div className="text-center">
                <div className={`text-4xl font-bold mb-2 ${
                  stockStatus === 'out' ? 'text-red-600' :
                  stockStatus === 'low' ? 'text-orange-500' : 'text-green-600'
                }`}>
                  {currentProduct.quantity}
                </div>
                <div className={`text-sm font-medium ${
                  stockStatus === 'out' ? 'text-red-600' :
                  stockStatus === 'low' ? 'text-orange-500' : 'text-green-600'
                }`}>
                  {stockStatus === 'out' ? 'OUT OF STOCK' :
                   stockStatus === 'low' ? 'LOW STOCK' : 'IN STOCK'}
                </div>
              </div>
              
              <div className="space-y-2 pt-4 border-t">
                <div className="flex justify-between">
                  <span>Current Stock:</span>
                  <span className="font-medium">{currentProduct.quantity}</span>
                </div>
                <div className="flex justify-between">
                  <span>Minimum Stock:</span>
                  <span className="font-medium">{currentProduct.minQuantity}</span>
                </div>
                <div className="flex justify-between">
                  <span>Stock Value:</span>
                  <span className="font-medium">
                    ${(currentProduct.quantity * currentProduct.cost).toFixed(2)}
                  </span>
                </div>
              </div>

              {stockStatus !== 'normal' && (
                <div className={`p-3 rounded ${
                  stockStatus === 'out' ? 'bg-red-50 border border-red-200' :
                  'bg-orange-50 border border-orange-200'
                }`}>
                  <div className={`text-sm font-medium ${
                    stockStatus === 'out' ? 'text-red-800' : 'text-orange-800'
                  }`}>
                    ⚠️ {stockStatus === 'out' ? 'Stock Alert' : 'Low Stock Alert'}
                  </div>
                  <div className={`text-xs mt-1 ${
                    stockStatus === 'out' ? 'text-red-600' : 'text-orange-600'
                  }`}>
                    {stockStatus === 'out' ? 
                      'This product is out of stock and needs to be restocked.' :
                      'Stock level is below minimum threshold.'}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stock Adjustment Modal */}
      {showStockModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-90vw">
            <h3 className="text-lg font-semibold mb-4">Adjust Stock</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Adjustment Type
                </label>
                <select
                  value={stockAdjustment.type}
                  onChange={(e) => setStockAdjustment(prev => ({ 
                    ...prev, 
                    type: e.target.value as 'IN' | 'OUT' | 'ADJUSTMENT' 
                  }))}
                  className="w-full p-2 border rounded"
                >
                  <option value="IN">Stock In (+)</option>
                  <option value="OUT">Stock Out (-)</option>
                  <option value="ADJUSTMENT">Adjustment</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantity
                </label>
                <input
                  type="number"
                  value={stockAdjustment.quantity}
                  onChange={(e) => setStockAdjustment(prev => ({ 
                    ...prev, 
                    quantity: parseInt(e.target.value) || 0 
                  }))}
                  className="w-full p-2 border rounded"
                  min="1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason (Optional)
                </label>
                <textarea
                  value={stockAdjustment.reason}
                  onChange={(e) => setStockAdjustment(prev => ({ 
                    ...prev, 
                    reason: e.target.value 
                  }))}
                  className="w-full p-2 border rounded"
                  rows={3}
                  placeholder="Enter reason for stock adjustment..."
                />
              </div>

              <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                <strong>Current Stock:</strong> {currentProduct.quantity}<br />
                <strong>After Adjustment:</strong> {
                  stockAdjustment.type === 'OUT' ? 
                    currentProduct.quantity - Math.abs(stockAdjustment.quantity) :
                    currentProduct.quantity + Math.abs(stockAdjustment.quantity)
                }
              </div>
            </div>

            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => setShowStockModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleStockAdjustment}
                disabled={stockAdjustment.quantity <= 0}
                className="px-4 py-2 text-white bg-blue-500 rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Apply Adjustment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 