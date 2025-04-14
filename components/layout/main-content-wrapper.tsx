'use client';

import { usePathname } from 'next/navigation';
import React from 'react';
import { Footer } from '@/components/footer';

interface MainContentWrapperProps {
  children: React.ReactNode;
}

export function MainContentWrapper({ children }: MainContentWrapperProps) {
  const pathname = usePathname();

  return (
    <>
      <main className="flex-grow">{children}</main>
      {/* Conditionally render Footer based on path */} 
      {pathname !== '/dashboard' && <Footer />}
    </>
  );
} 