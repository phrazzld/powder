import { v } from 'convex/values';
import { query } from './_generated/server';

/**
 * NameManager Module - Queries
 *
 * Manages name pool queries with efficient index usage.
 * Provides simple interface for retrieving names by status or ID.
 */

// ============ Queries ============

/**
 * List all names, optionally filtered by status
 * Uses by_status index when status filter is provided
 */
export const listNames = query({
  args: {
    status: v.optional(
      v.union(
        v.literal('available'),
        v.literal('assigned'),
        v.literal('considering')
      )
    ),
  },
  handler: async (ctx, args) => {
    if (args.status) {
      // Use by_status index for efficient filtered query
      return await ctx.db
        .query('names')
        .withIndex('by_status', (q) => q.eq('status', args.status!))
        .collect();
    }

    // Return all names when no filter specified
    return await ctx.db.query('names').collect();
  },
});

/**
 * Get all available names (for form dropdowns, name selection)
 * Convenience query that wraps listNames with status filter
 */
export const getAvailableNames = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query('names')
      .withIndex('by_status', (q) => q.eq('status', 'available'))
      .collect();
  },
});

/**
 * Get single name by ID
 * Returns null if name doesn't exist
 */
export const getName = query({
  args: { nameId: v.id('names') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.nameId);
  },
});
