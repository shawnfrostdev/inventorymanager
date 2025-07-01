import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { apiClient } from '@/lib/api';

// Types
interface Product {
  id: string;
  name: string;
  description?: string;
  sku: string;
  barcode?: string;
  price: number;
  cost: number;
  quantity: number;
  minQuantity: number;
  imageUrl?: string;
  categoryId: string;
  category?: Category;
}

interface Category {
  id: string;
  name: string;
  description?: string;
  _count?: {
    products: number;
  };
}

interface StockMovement {
  id: string;
  type: 'IN' | 'OUT' | 'ADJUSTMENT';
  quantity: number;
  reason?: string;
  productId: string;
  createdAt: string;
  createdBy: {
    id: string;
    name: string;
  };
}

interface ProductState {
  products: Product[];
  categories: Category[];
  selectedProduct: Product | null;
  stockMovements: StockMovement[];
  loading: boolean;
  error: string | null;
}

// Initial state
const initialState: ProductState = {
  products: [],
  categories: [],
  selectedProduct: null,
  stockMovements: [],
  loading: false,
  error: null,
};

// Thunks
export const fetchProducts = createAsyncThunk(
  'product/fetchProducts',
  async ({ search, categoryId }: { search?: string; categoryId?: string } = {}) => {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (categoryId) params.append('categoryId', categoryId);
    
    const response = await apiClient.get(`/api/products?${params.toString()}`);
    const data = await response.json();
    return data.data;
  }
);

export const fetchProduct = createAsyncThunk(
  'product/fetchProduct',
  async (id: string) => {
    const response = await apiClient.get(`/api/products/${id}`);
    const data = await response.json();
    return data.data;
  }
);

export const createProduct = createAsyncThunk(
  'product/createProduct',
  async (data: FormData) => {
    const response = await apiClient.request('/api/products', {
      method: 'POST',
      body: data,
      headers: {} // Don't set Content-Type for FormData
    });
    const result = await response.json();
    return result.data;
  }
);

export const updateProduct = createAsyncThunk(
  'product/updateProduct',
  async ({ id, data }: { id: string; data: FormData }) => {
    const response = await apiClient.request(`/api/products/${id}`, {
      method: 'PUT',
      body: data,
      headers: {} // Don't set Content-Type for FormData
    });
    const result = await response.json();
    return result.data;
  }
);

export const deleteProduct = createAsyncThunk(
  'product/deleteProduct',
  async (id: string) => {
    await apiClient.delete(`/api/products/${id}`);
    return id;
  }
);

export const fetchCategories = createAsyncThunk(
  'product/fetchCategories',
  async () => {
    const response = await apiClient.get('/api/products/categories');
    const data = await response.json();
    return data.data;
  }
);

export const createCategory = createAsyncThunk(
  'product/createCategory',
  async (data: { name: string; description?: string }) => {
    const response = await apiClient.post('/api/products/categories', data);
    const result = await response.json();
    return result.data;
  }
);

export const updateCategory = createAsyncThunk(
  'product/updateCategory',
  async ({ id, data }: { id: string; data: { name?: string; description?: string } }) => {
    const response = await apiClient.put(`/api/products/categories/${id}`, data);
    const result = await response.json();
    return result.data;
  }
);

export const deleteCategory = createAsyncThunk(
  'product/deleteCategory',
  async (id: string) => {
    await apiClient.delete(`/api/products/categories/${id}`);
    return id;
  }
);

export const createStockMovement = createAsyncThunk(
  'product/createStockMovement',
  async (data: { type: 'IN' | 'OUT' | 'ADJUSTMENT'; quantity: number; reason?: string; productId: string }) => {
    const response = await apiClient.post('/api/products/stock-movements', data);
    const result = await response.json();
    return result.data;
  }
);

export const fetchStockMovements = createAsyncThunk(
  'product/fetchStockMovements',
  async (productId: string) => {
    const response = await apiClient.get(`/api/products/stock-movements/${productId}`);
    const data = await response.json();
    return data.data;
  }
);

// Slice
const productSlice = createSlice({
  name: 'product',
  initialState,
  reducers: {
    clearSelectedProduct: (state) => {
      state.selectedProduct = null;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch products
      .addCase(fetchProducts.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchProducts.fulfilled, (state, action) => {
        state.loading = false;
        state.products = action.payload;
      })
      .addCase(fetchProducts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch products';
      })

      // Fetch single product
      .addCase(fetchProduct.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchProduct.fulfilled, (state, action) => {
        state.loading = false;
        state.selectedProduct = action.payload;
      })
      .addCase(fetchProduct.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch product';
      })

      // Create product
      .addCase(createProduct.fulfilled, (state, action) => {
        state.products.push(action.payload);
      })

      // Update product
      .addCase(updateProduct.fulfilled, (state, action) => {
        const index = state.products.findIndex(p => p.id === action.payload.id);
        if (index !== -1) {
          state.products[index] = action.payload;
        }
        if (state.selectedProduct?.id === action.payload.id) {
          state.selectedProduct = action.payload;
        }
      })

      // Delete product
      .addCase(deleteProduct.fulfilled, (state, action) => {
        state.products = state.products.filter(p => p.id !== action.payload);
        if (state.selectedProduct?.id === action.payload) {
          state.selectedProduct = null;
        }
      })

      // Fetch categories
      .addCase(fetchCategories.fulfilled, (state, action) => {
        state.categories = action.payload;
      })

      // Create category
      .addCase(createCategory.fulfilled, (state, action) => {
        state.categories.push(action.payload);
      })

      // Update category
      .addCase(updateCategory.fulfilled, (state, action) => {
        const index = state.categories.findIndex(c => c.id === action.payload.id);
        if (index !== -1) {
          state.categories[index] = action.payload;
        }
      })

      // Delete category
      .addCase(deleteCategory.fulfilled, (state, action) => {
        state.categories = state.categories.filter(c => c.id !== action.payload);
      })

      // Fetch stock movements
      .addCase(fetchStockMovements.fulfilled, (state, action) => {
        state.stockMovements = action.payload;
      })

      // Create stock movement
      .addCase(createStockMovement.fulfilled, (state, action) => {
        state.stockMovements.unshift(action.payload);
        if (state.selectedProduct) {
          state.selectedProduct.quantity = action.payload.newQuantity;
        }
      });
  },
});

export const { clearSelectedProduct, clearError } = productSlice.actions;
export default productSlice.reducer; 