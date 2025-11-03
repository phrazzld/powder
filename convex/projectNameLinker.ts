import { v, ConvexError } from 'convex/values';
import { mutation } from './_generated/server';
import type { Id } from './_generated/dataModel';
import { internal } from './_generated/api';

/**
 * ProjectNameLinker Module
 *
 * Handles all operations that modify both names and projects tables.
 * Ensures atomic updates and maintains referential integrity.
 * This is the most complex module - handles cross-table transactions.
 */

// ============ Mutations ============

/**
 * Links names to a project based on project status
 * Atomic operation across both tables
 */
export const linkNamesToProject = mutation({
  args: {
    projectId: v.id('projects'),
    status: v.union(
      v.literal('idea'),
      v.literal('active'),
      v.literal('paused'),
      v.literal('archived')
    ),
    nameId: v.optional(v.id('names')),
    consideringNameIds: v.array(v.id('names')),
  },
  handler: async (ctx, args): Promise<void> => {
    if (args.status === 'idea') {
      // Ideas: link considering names
      for (const nameId of args.consideringNameIds) {
        const name = await ctx.db.get(nameId);
        if (!name) {
          throw new ConvexError(`Name ${nameId} not found`);
        }

        // Validate name is not assigned to another project
        if (name.status === 'assigned' && name.assignedTo !== args.projectId) {
          throw new ConvexError(
            `Name "${name.name}" is already assigned to another project`
          );
        }

        // Transition to "considering"
        await ctx.runMutation(internal.names._transitionNameState, {
          nameId,
          toStatus: 'considering',
        });
      }
    } else {
      // Active/paused/archived: must have exactly one assigned name
      if (!args.nameId) {
        throw new ConvexError('Active projects must have an assigned name');
      }

      const name = await ctx.db.get(args.nameId);
      if (!name) {
        throw new ConvexError(`Name ${args.nameId} not found`);
      }

      // Validate name is not assigned to another project
      if (name.status === 'assigned' && name.assignedTo !== args.projectId) {
        throw new ConvexError(
          `Name "${name.name}" is already assigned to another project`
        );
      }

      // Transition to "assigned"
      await ctx.runMutation(internal.names._transitionNameState, {
        nameId: args.nameId,
        toStatus: 'assigned',
        assignedTo: args.projectId,
      });
    }
  },
});

/**
 * Updates project names when names change
 * Releases old names and links new names
 */
export const updateProjectNames = mutation({
  args: {
    projectId: v.id('projects'),
    oldNameId: v.optional(v.id('names')),
    newNameId: v.optional(v.id('names')),
    oldConsideringNameIds: v.array(v.id('names')),
    newConsideringNameIds: v.array(v.id('names')),
  },
  handler: async (ctx, args): Promise<void> => {
    // Release old assigned name if changed
    if (args.oldNameId && args.oldNameId !== args.newNameId) {
      await ctx.runMutation(internal.names._transitionNameState, {
        nameId: args.oldNameId,
        toStatus: 'available',
      });
    }

    // Release old considering names that are no longer being considered
    for (const oldNameId of args.oldConsideringNameIds) {
      if (!args.newConsideringNameIds.includes(oldNameId)) {
        await ctx.runMutation(internal.names._transitionNameState, {
          nameId: oldNameId,
          toStatus: 'available',
        });
      }
    }

    // Link new assigned name if changed
    if (args.newNameId && args.newNameId !== args.oldNameId) {
      const name = await ctx.db.get(args.newNameId);
      if (!name) {
        throw new ConvexError(`Name ${args.newNameId} not found`);
      }

      if (name.status === 'assigned' && name.assignedTo !== args.projectId) {
        throw new ConvexError(
          `Name "${name.name}" is already assigned to another project`
        );
      }

      await ctx.runMutation(internal.names._transitionNameState, {
        nameId: args.newNameId,
        toStatus: 'assigned',
        assignedTo: args.projectId,
      });
    }

    // Link new considering names
    for (const newNameId of args.newConsideringNameIds) {
      if (!args.oldConsideringNameIds.includes(newNameId)) {
        const name = await ctx.db.get(newNameId);
        if (!name) {
          throw new ConvexError(`Name ${newNameId} not found`);
        }

        if (name.status === 'assigned' && name.assignedTo !== args.projectId) {
          throw new ConvexError(
            `Name "${name.name}" is already assigned to another project`
          );
        }

        await ctx.runMutation(internal.names._transitionNameState, {
          nameId: newNameId,
          toStatus: 'considering',
        });
      }
    }
  },
});

/**
 * Promotes an idea to active status
 * Validates, releases unconsidered names, assigns chosen name
 */
export const promoteIdeaToActive = mutation({
  args: {
    projectId: v.id('projects'),
    chosenNameId: v.id('names'),
  },
  handler: async (ctx, args): Promise<void> => {
    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new ConvexError('Project not found');
    }

    // Validate project is an idea
    if (project.status !== 'idea') {
      throw new ConvexError('Can only promote ideas to active');
    }

    // Validate chosen name is being considered
    if (!project.consideringNameIds.includes(args.chosenNameId)) {
      throw new ConvexError('Chosen name is not being considered by this idea');
    }

    // Release all considering names except chosen
    for (const nameId of project.consideringNameIds) {
      if (nameId !== args.chosenNameId) {
        await ctx.runMutation(internal.names._transitionNameState, {
          nameId,
          toStatus: 'available',
        });
      }
    }

    // Assign chosen name
    await ctx.runMutation(internal.names._transitionNameState, {
      nameId: args.chosenNameId,
      toStatus: 'assigned',
      assignedTo: args.projectId,
    });

    // Update project
    await ctx.db.patch(args.projectId, {
      status: 'active',
      nameId: args.chosenNameId,
      consideringNameIds: [],
      updatedAt: Date.now(),
    });
  },
});

/**
 * Releases all names linked to a project
 * Optionally releases to pool or keeps as considering
 */
export const releaseProjectNames = mutation({
  args: {
    projectId: v.id('projects'),
    releaseToPool: v.boolean(),
  },
  handler: async (ctx, args): Promise<void> => {
    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new ConvexError('Project not found');
    }

    // Release assigned name
    if (project.nameId) {
      const newStatus = args.releaseToPool ? 'available' : 'considering';
      await ctx.runMutation(internal.names._transitionNameState, {
        nameId: project.nameId,
        toStatus: newStatus,
      });
    }

    // Release all considering names
    for (const nameId of project.consideringNameIds) {
      await ctx.runMutation(internal.names._transitionNameState, {
        nameId,
        toStatus: 'available',
      });
    }
  },
});

/**
 * Handles status changes that affect name relationships
 * Called when project status transitions
 */
export const handleStatusChange = mutation({
  args: {
    projectId: v.id('projects'),
    oldStatus: v.union(
      v.literal('idea'),
      v.literal('active'),
      v.literal('paused'),
      v.literal('archived')
    ),
    newStatus: v.union(
      v.literal('idea'),
      v.literal('active'),
      v.literal('paused'),
      v.literal('archived')
    ),
  },
  handler: async (ctx, args): Promise<void> => {
    // Most status changes don't affect name relationships
    // active <-> paused: no change (keeps assigned name)
    // active <-> archived: no change (keeps assigned name)
    // paused <-> archived: no change (keeps assigned name)

    // Edge case: active/paused/archived -> idea would need UI confirmation
    // This should be prevented by business rules in ProjectManager
    // We don't implement automatic demotion here

    if (args.oldStatus === 'idea' && args.newStatus !== 'idea') {
      // Idea promoted to active/paused/archived
      // This should go through promoteIdeaToActive instead
      // If it happens here, validate project has assigned name
      const project = await ctx.db.get(args.projectId);
      if (!project?.nameId) {
        throw new ConvexError(
          'Cannot transition from idea without assigning a name. Use promoteIdeaToActive instead.'
        );
      }
    }

    // No action needed for most transitions
    // Name relationships are maintained correctly by ProjectManager validation
  },
});
