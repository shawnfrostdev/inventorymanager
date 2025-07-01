'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAppSelector } from '@/lib/redux/hooks';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, user } = useAppSelector((state) => state.auth);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/login');
    } else if (!user?.isEmailVerified) {
      router.push('/auth/verify-email-sent');
    }
  }, [isAuthenticated, user, router]);

  // Don't render children until we've checked authentication
  if (!isAuthenticated || !user?.isEmailVerified) {
    return null;
  }

  return <>{children}</>;
} 