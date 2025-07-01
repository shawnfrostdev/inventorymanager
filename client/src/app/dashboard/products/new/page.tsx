'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppDispatch } from '@/lib/redux/hooks';
import { createProduct } from '@/lib/redux/features/productSlice';
import ProductForm from '@/components/products/ProductForm';

export default function NewProductPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (formData: FormData) => {
    try {
      setIsLoading(true);
      await dispatch(createProduct(formData)).unwrap();
      router.push('/dashboard/products');
    } catch (error) {
      console.error('Failed to create product:', error);
      // You might want to show an error toast here
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Create New Product</h1>
      <ProductForm onSubmit={handleSubmit} isLoading={isLoading} />
    </div>
  );
} 