'use client';

import { AuthProvider } from '@/contexts/AuthContext';
// Import other client-side providers if needed in the future

export function Providers({ children }: { children: React.ReactNode }) {
  return (
      <AuthProvider>
        {/* Wrap with other providers here */}
        {children}
      </AuthProvider>
  );
} 