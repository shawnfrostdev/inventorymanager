'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAppSelector } from '@/lib/redux/hooks';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, user } = useAppSelector((state) => state.auth);
  const [isClient, setIsClient] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Handle client-side hydration
  useEffect(() => {
    setIsClient(true);
    setIsLoading(false);
  }, []);

  // Handle authentication redirects only on client
  useEffect(() => {
    if (!isClient) return;

    if (!isAuthenticated) {
      router.push('/auth/login');
    } else if (user && !user.isEmailVerified) {
      router.push('/auth/verify-email-sent');
    }
  }, [isAuthenticated, user, router, isClient]);

  // Show loading during SSR and initial hydration
  if (!isClient || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Don't render children until we've verified authentication on client
  if (!isAuthenticated || (user && !user.isEmailVerified)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return <>{children}</>;
} 