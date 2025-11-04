'use client';

import { ConvexProvider } from 'convex/react';
import { Toaster } from 'sonner';
import { convex } from '@/lib/convex';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ConvexProvider client={convex}>
      {children}
      <Toaster position="top-right" />
    </ConvexProvider>
  );
}
