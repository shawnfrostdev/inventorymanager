'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/lib/redux/hooks';
import { fetchProduct, updateProduct, deleteProduct, createStockMovement, fetchStockMovements } from '@/lib/redux/features/productSlice';
import ProductForm from '@/components/products/ProductForm';
import Image from 'next/image';

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { selectedProduct, stockMovements, loading } = useAppSelector((state) => state.product);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);
  const [stockMovementData, setStockMovementData] = useState({
    type: 'IN' as 'IN' | 'OUT' | 'ADJUSTMENT',
    quantity: 0,
    reason: '',
  });

  useEffect(() => {
    if (params.id) {
      dispatch(fetchProduct(params.id as string));
      dispatch(fetchStockMovements(params.id as string));
    }
  }, [dispatch, params.id]);

  const handleUpdate = async (formData: FormData) => {
    try {
      setIsLoading(true);
      await dispatch(updateProduct({ id: params.id as string, data: formData })).unwrap();
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update product:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      try {
        setIsLoading(true);
        await dispatch(deleteProduct(params.id as string)).unwrap();
        router.push('/dashboard/products');
      } catch (error) {
        console.error('Failed to delete product:', error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleStockMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      await dispatch(createStockMovement({
        ...stockMovementData,
        productId: params.id as string,
      })).unwrap();
      setShowStockModal(false);
      setStockMovementData({
        type: 'IN',
        quantity: 0,
        reason: '',
      });
    } catch (error) {
      console.error('Failed to create stock movement:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (loading || !selectedProduct) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (isEditing) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Edit Product</h1>
          <button
            onClick={() => setIsEditing(false)}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
          >
            Cancel
          </button>
        </div>
        <ProductForm
          initialData={selectedProduct}
          onSubmit={handleUpdate}
          isLoading={isLoading}
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">{selectedProduct.name}</h1>
        <div className="space-x-4">
          <button
            onClick={() => setShowStockModal(true)}
            className="px-4 py-2 text-white bg-green-500 rounded hover:bg-green-600"
          >
            Manage Stock
          </button>
          <button
            onClick={() => setIsEditing(true)}
            className="px-4 py-2 text-white bg-blue-500 rounded hover:bg-blue-600"
          >
            Edit
          </button>
          <button
            onClick={handleDelete}
            className="px-4 py-2 text-white bg-red-500 rounded hover:bg-red-600"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <div className="aspect-square relative rounded-lg overflow-hidden border">
            {selectedProduct.imageUrl ? (
              <Image
                src={selectedProduct.imageUrl}
                alt={selectedProduct.name}
                fill
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                <span className="text-gray-400">No image</span>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-4">Product Details</h2>
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-gray-600">SKU</dt>
                <dd>{selectedProduct.sku}</dd>
              </div>
              <div>
                <dt className="text-gray-600">Barcode</dt>
                <dd>{selectedProduct.barcode || 'N/A'}</dd>
              </div>
              <div>
                <dt className="text-gray-600">Price</dt>
                <dd>${selectedProduct.price.toFixed(2)}</dd>
              </div>
              <div>
                <dt className="text-gray-600">Cost</dt>
                <dd>${selectedProduct.cost.toFixed(2)}</dd>
              </div>
              <div>
                <dt className="text-gray-600">Current Stock</dt>
                <dd className={selectedProduct.quantity <= selectedProduct.minQuantity ? 'text-red-500' : 'text-green-500'}>
                  {selectedProduct.quantity}
                </dd>
              </div>
              <div>
                <dt className="text-gray-600">Minimum Stock</dt>
                <dd>{selectedProduct.minQuantity}</dd>
              </div>
              <div>
                <dt className="text-gray-600">Category</dt>
                <dd>{selectedProduct.category?.name}</dd>
              </div>
            </dl>
          </div>

          {selectedProduct.description && (
            <div>
              <h2 className="text-xl font-semibold mb-2">Description</h2>
              <p className="text-gray-600">{selectedProduct.description}</p>
            </div>
          )}

          <div>
            <h2 className="text-xl font-semibold mb-4">Recent Stock Movements</h2>
            <div className="space-y-2">
              {stockMovements.map((movement) => (
                <div
                  key={movement.id}
                  className="flex justify-between items-center p-3 bg-gray-50 rounded"
                >
                  <div>
                    <span className={`font-semibold ${
                      movement.type === 'IN' ? 'text-green-600' : movement.type === 'OUT' ? 'text-red-600' : 'text-blue-600'
                    }`}>
                      {movement.type}
                    </span>
                    <span className="text-gray-600 ml-2">
                      {movement.quantity} units
                    </span>
                  </div>
                  <div className="text-sm text-gray-500">
                    {new Date(movement.createdAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Stock Movement Modal */}
      {showStockModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">Manage Stock</h2>
            <form onSubmit={handleStockMovement} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Movement Type
                </label>
                <select
                  value={stockMovementData.type}
                  onChange={(e) => setStockMovementData(prev => ({
                    ...prev,
                    type: e.target.value as 'IN' | 'OUT' | 'ADJUSTMENT'
                  }))}
                  className="w-full p-2 border rounded"
                >
                  <option value="IN">Stock In</option>
                  <option value="OUT">Stock Out</option>
                  <option value="ADJUSTMENT">Adjustment</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantity
                </label>
                <input
                  type="number"
                  value={stockMovementData.quantity}
                  onChange={(e) => setStockMovementData(prev => ({
                    ...prev,
                    quantity: parseInt(e.target.value) || 0
                  }))}
                  min="0"
                  required
                  className="w-full p-2 border rounded"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason
                </label>
                <input
                  type="text"
                  value={stockMovementData.reason}
                  onChange={(e) => setStockMovementData(prev => ({
                    ...prev,
                    reason: e.target.value
                  }))}
                  className="w-full p-2 border rounded"
                  placeholder="Optional reason for the stock movement"
                />
              </div>

              <div className="flex justify-end space-x-4 mt-6">
                <button
                  type="button"
                  onClick={() => setShowStockModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-4 py-2 text-white bg-blue-500 rounded hover:bg-blue-600 disabled:opacity-50"
                >
                  {isLoading ? 'Processing...' : 'Submit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
} 