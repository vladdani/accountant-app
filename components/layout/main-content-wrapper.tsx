'use client';

import React from 'react';

interface MainContentWrapperProps {
  children: React.ReactNode;
}

export function MainContentWrapper({ children }: MainContentWrapperProps) {
  return (
    <>
      <main className="flex-grow">{children}</main>
    </>
  );
} 