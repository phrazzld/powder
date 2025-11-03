import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { ConvexError } from 'convex/values';

/**
 * NameManager Module
 *
 * Manages name pool lifecycle: queries, creation, and state transitions.
 * Enforces name uniqueness and valid state machine transitions.
 *
 * State Machine:
 * available ─────► considering ─────► assigned
 *     ▲                 │                  │
 *     │                 │                  │
 *     └─────────────────┴──────────────────┘
 *         (release back to pool)
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

// ============ Mutations ============

/**
 * Create a new name in the pool with status "available"
 * Validates name uniqueness using by_name index
 * Throws ConvexError if name already exists
 */
export const createName = mutation({
  args: {
    name: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check for duplicate name using by_name index
    const existing = await ctx.db
      .query('names')
      .withIndex('by_name', (q) => q.eq('name', args.name))
      .first();

    if (existing) {
      throw new ConvexError(`Name "${args.name}" already exists`);
    }

    // Create name with status "available"
    const nameId = await ctx.db.insert('names', {
      name: args.name,
      status: 'available',
      notes: args.notes,
    });

    return nameId;
  },
});

/**
 * Update notes for an existing name
 * Does not affect status or assignment
 */
export const updateNameNotes = mutation({
  args: {
    nameId: v.id('names'),
    notes: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.nameId, {
      notes: args.notes,
    });
  },
});

/**
 * Internal mutation for state transitions
 * Validates state machine rules and updates status/assignedTo
 *
 * Valid transitions:
 * - available → considering (when added to idea)
 * - considering → assigned (when idea becomes active)
 * - considering → available (when removed from idea)
 * - assigned → available (when project deleted)
 *
 * @internal - Not exported to client, used by ProjectNameLinker
 */
export const _transitionNameState = mutation({
  args: {
    nameId: v.id('names'),
    toStatus: v.union(
      v.literal('available'),
      v.literal('assigned'),
      v.literal('considering')
    ),
    assignedTo: v.optional(v.id('projects')),
  },
  handler: async (ctx, args) => {
    const name = await ctx.db.get(args.nameId);
    if (!name) {
      throw new ConvexError(`Name with ID ${args.nameId} not found`);
    }

    const fromStatus = name.status;
    const toStatus = args.toStatus;

    // Validate state transition
    const validTransitions: Record<string, string[]> = {
      available: ['considering', 'assigned'],
      considering: ['available', 'assigned'],
      assigned: ['available'],
    };

    if (!validTransitions[fromStatus]?.includes(toStatus)) {
      throw new ConvexError(
        `Invalid state transition: ${fromStatus} → ${toStatus}`
      );
    }

    // Update name with new status and assignment
    await ctx.db.patch(args.nameId, {
      status: toStatus,
      assignedTo: args.assignedTo,
    });
  },
});
