import { v, ConvexError } from 'convex/values';
import { mutation, query, internalMutation } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';

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
type NameStatus = 'available' | 'assigned' | 'considering';

type EnrichedName = Doc<'names'> & {
  status: NameStatus;
  assignedTo?: Id<'projects'>;
  consideringProjectIds: Id<'projects'>[];
};

export const listNames = query({
  args: {
    status: v.optional(
      v.union(v.literal('available'), v.literal('assigned'), v.literal('considering'))
    ),
    sortBy: v.optional(v.union(v.literal('name'), v.literal('createdAt'))),
    sortOrder: v.optional(v.union(v.literal('asc'), v.literal('desc'))),
  },
  handler: async (ctx, args): Promise<EnrichedName[]> => {
    const names = await ctx.db.query('names').collect();
    const projects = await ctx.db.query('projects').collect();

    const assignedByName = new Map<Id<'names'>, Id<'projects'>>();
    const consideringByName = new Map<Id<'names'>, Id<'projects'>[]>();

    for (const project of projects) {
      if (project.nameId) {
        assignedByName.set(project.nameId, project._id);
      }

      for (const nameId of project.consideringNameIds) {
        const list = consideringByName.get(nameId) ?? [];
        list.push(project._id);
        consideringByName.set(nameId, list);
      }
    }

    const enriched: EnrichedName[] = names.map((name) => {
      const assignedProjectId = assignedByName.get(name._id);
      const consideringProjectIds = consideringByName.get(name._id) ?? [];
      const status: NameStatus = assignedProjectId
        ? 'assigned'
        : consideringProjectIds.length > 0
        ? 'considering'
        : 'available';

      return {
        ...name,
        status,
        assignedTo: assignedProjectId,
        consideringProjectIds,
      };
    });

    const filtered = args.status ? enriched.filter((name) => name.status === args.status) : enriched;

    const sortBy = args.sortBy ?? 'name';
    const sortOrder = args.sortOrder ?? 'asc';

    filtered.sort((a, b) => {
      let comparison: number;
      if (sortBy === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else {
        comparison = a._creationTime - b._creationTime;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
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
 * Rename an existing name and enforce uniqueness
 */
export const updateName = mutation({
  args: {
    nameId: v.id('names'),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const trimmed = args.name.trim();
    if (trimmed.length === 0) {
      throw new ConvexError('Name cannot be empty');
    }

    const existing = await ctx.db
      .query('names')
      .withIndex('by_name', (q) => q.eq('name', trimmed))
      .first();

    if (existing && existing._id !== args.nameId) {
      throw new ConvexError(`Name "${trimmed}" already exists`);
    }

    await ctx.db.patch(args.nameId, {
      name: trimmed,
    });
  },
});

/**
 * Delete a name that is not in use
 */
export const deleteName = mutation({
  args: {
    nameId: v.id('names'),
  },
  handler: async (ctx, args) => {
    const name = await ctx.db.get(args.nameId);
    if (!name) {
      throw new ConvexError('Name not found');
    }

    const assignedProject = await ctx.db
      .query('projects')
      .withIndex('by_name', (q) => q.eq('nameId', args.nameId))
      .first();

    if (assignedProject) {
      throw new ConvexError('Cannot delete a name that is assigned to a project');
    }

    const consideringProjects = await ctx.db.query('projects').collect();
    const isBeingConsidered = consideringProjects.some((project) =>
      project.consideringNameIds.includes(args.nameId)
    );

    if (isBeingConsidered) {
      throw new ConvexError('Cannot delete a name that is being considered by a project');
    }

    await ctx.db.delete(args.nameId);
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
export const _transitionNameState = internalMutation({
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
