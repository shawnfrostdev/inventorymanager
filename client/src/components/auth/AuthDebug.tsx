'use client';

import { useAppSelector } from '@/lib/redux/hooks';
import { useEffect, useState } from 'react';

export function AuthDebug() {
  const auth = useAppSelector((state) => state.auth);
  const [localStorageData, setLocalStorageData] = useState<string>('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const data = localStorage.getItem('persist:auth');
      setLocalStorageData(data || 'No data found');
    }
  }, []);

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 bg-black bg-opacity-80 text-white p-4 rounded text-xs max-w-sm z-50">
      <h3 className="font-bold mb-2">Auth Debug</h3>
      <div className="space-y-1">
        <div>Authenticated: {auth.isAuthenticated ? 'Yes' : 'No'}</div>
        <div>User: {auth.user?.email || 'None'}</div>
        <div>Token: {auth.accessToken ? 'Present' : 'Missing'}</div>
        <div className="text-xs break-all">
          LocalStorage: {localStorageData.substring(0, 100)}...
        </div>
      </div>
    </div>
  );
} 