export interface User {
  id: string;
  email: string;
  name: string | null;
  role: 'ADMIN' | 'MANAGER' | 'STAFF';
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
}

export interface RootState {
  auth: AuthState;
  // Add other state slices here as needed
} 