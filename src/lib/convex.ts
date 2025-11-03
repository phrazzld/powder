import { ConvexReactClient } from 'convex/react';

if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
  throw new Error('NEXT_PUBLIC_CONVEX_URL is not set');
}

export const convex = new ConvexReactClient(
  process.env.NEXT_PUBLIC_CONVEX_URL
);
