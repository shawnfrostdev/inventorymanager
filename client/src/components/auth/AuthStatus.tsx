'use client';

import { useAppSelector } from '@/lib/redux/hooks';

export function AuthStatus() {
  const auth = useAppSelector((state) => state.auth);
  
  return (
    <div className="text-sm text-gray-600">
      Status: {auth.isAuthenticated ? 'Logged In' : 'Not Logged In'}
    </div>
  );
} 