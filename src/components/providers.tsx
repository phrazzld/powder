'use client';

import { ConvexProvider } from 'convex/react';
import { Toaster } from 'sonner';
import { useTheme } from 'next-themes';
import { convex } from '@/lib/convex';

const TOAST_DURATION_MS = 4000;
const TOASTER_OFFSET = { bottom: '1.5rem', right: '1.5rem' } as const;
const TOASTER_MOBILE_OFFSET = { bottom: '1rem', left: '1rem', right: '1rem' } as const;

export function Providers({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();
  const toasterTheme = resolvedTheme === 'dark' ? 'dark' : 'light';

  return (
    <ConvexProvider client={convex}>
      {children}
      <Toaster
        position="bottom-right"
        offset={TOASTER_OFFSET}
        mobileOffset={TOASTER_MOBILE_OFFSET}
        toastOptions={{ duration: TOAST_DURATION_MS }}
        theme={toasterTheme}
      />
    </ConvexProvider>
  );
}
