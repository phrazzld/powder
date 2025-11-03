import { v, ConvexError } from 'convex/values';
import { mutation, query } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';

/**
 * ProjectManager Module
 *
 * Manages project CRUD operations with business rule validation.
 * Provides queries with name enrichment and mutations with validation.
 */

// ============ Types ============

type Project = Doc<'projects'>;

type ProjectWithName = Project & {
  name?: string; // Resolved from nameId
  consideringNames: string[]; // Resolved from consideringNameIds
};

type ProjectStats = {
  total: number;
  byStatus: {
    idea: number;
    active: number;
    paused: number;
    archived: number;
  };
};

// ============ Queries ============

/**
 * List projects with filtering, search, and sorting
 * Enriches projects with name data by joining with names table
 */
export const listProjects = query({
  args: {
    status: v.optional(
      v.union(
        v.literal('idea'),
        v.literal('active'),
        v.literal('paused'),
        v.literal('archived')
      )
    ),
    search: v.optional(v.string()),
    sortBy: v.optional(
      v.union(
        v.literal('createdAt'),
        v.literal('updatedAt'),
        v.literal('name')
      )
    ),
    sortOrder: v.optional(v.union(v.literal('asc'), v.literal('desc'))),
  },
  handler: async (ctx, args): Promise<ProjectWithName[]> => {
    // 1. Build base query with optional status filter
    let projects: Project[];
    if (args.status) {
      projects = await ctx.db
        .query('projects')
        .withIndex('by_status', (q) => q.eq('status', args.status!))
        .collect();
    } else {
      projects = await ctx.db.query('projects').collect();
    }

    // 2. Enrich with name data
    const enrichedProjects: ProjectWithName[] = [];
    for (const project of projects) {
      // Resolve assigned name
      let name: string | undefined;
      if (project.nameId) {
        const nameDoc = await ctx.db.get(project.nameId);
        name = nameDoc?.name;
      }

      // Resolve considering names
      const consideringNames: string[] = [];
      for (const nameId of project.consideringNameIds) {
        const nameDoc = await ctx.db.get(nameId);
        if (nameDoc) {
          consideringNames.push(nameDoc.name);
        }
      }

      enrichedProjects.push({
        ...project,
        name,
        consideringNames,
      });
    }

    // 3. Apply search filter (client-side)
    let filteredProjects = enrichedProjects;
    if (args.search) {
      const searchLower = args.search.toLowerCase();
      filteredProjects = enrichedProjects.filter(
        (p) =>
          p.name?.toLowerCase().includes(searchLower) ||
          p.description?.toLowerCase().includes(searchLower)
      );
    }

    // 4. Sort
    if (args.sortBy) {
      const sortOrder = args.sortOrder || 'desc';
      filteredProjects.sort((a, b) => {
        let aVal: any;
        let bVal: any;

        if (args.sortBy === 'name') {
          aVal = a.name || '';
          bVal = b.name || '';
        } else {
          aVal = a[args.sortBy!];
          bVal = b[args.sortBy!];
        }

        if (sortOrder === 'asc') {
          return aVal > bVal ? 1 : -1;
        } else {
          return aVal < bVal ? 1 : -1;
        }
      });
    }

    return filteredProjects;
  },
});

/**
 * Get single project by ID with name enrichment
 * Returns null if project doesn't exist
 */
export const getProject = query({
  args: { projectId: v.id('projects') },
  handler: async (ctx, args): Promise<ProjectWithName | null> => {
    const project = await ctx.db.get(args.projectId);
    if (!project) {
      return null;
    }

    // Resolve assigned name
    let name: string | undefined;
    if (project.nameId) {
      const nameDoc = await ctx.db.get(project.nameId);
      name = nameDoc?.name;
    }

    // Resolve considering names
    const consideringNames: string[] = [];
    for (const nameId of project.consideringNameIds) {
      const nameDoc = await ctx.db.get(nameId);
      if (nameDoc) {
        consideringNames.push(nameDoc.name);
      }
    }

    return {
      ...project,
      name,
      consideringNames,
    };
  },
});

/**
 * Get project statistics for dashboard overview
 * Returns total count and counts per status
 */
export const getProjectStats = query({
  args: {},
  handler: async (ctx): Promise<ProjectStats> => {
    const allProjects = await ctx.db.query('projects').collect();

    const stats: ProjectStats = {
      total: allProjects.length,
      byStatus: {
        idea: 0,
        active: 0,
        paused: 0,
        archived: 0,
      },
    };

    for (const project of allProjects) {
      stats.byStatus[project.status]++;
    }

    return stats;
  },
});

// ============ Mutations ============

// ============ Helper Functions ============

/**
 * Validates URL format
 */
function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates business rules for project creation/update
 * Throws ConvexError if validation fails
 */
function validateProjectRules(args: {
  status: 'idea' | 'active' | 'paused' | 'archived';
  nameId?: Id<'names'>;
  consideringNameIds: Id<'names'>[];
  githubRepo?: string;
  productionUrl?: string;
}): void {
  // Rule: Ideas cannot have assigned name
  if (args.status === 'idea') {
    if (args.nameId !== undefined) {
      throw new ConvexError('Ideas cannot have an assigned name');
    }
  } else {
    // Rule: Active/paused/archived must have assigned name
    if (!args.nameId) {
      throw new ConvexError(
        'Active, paused, and archived projects must have an assigned name'
      );
    }
    // Rule: Active/paused/archived cannot consider names
    if (args.consideringNameIds.length > 0) {
      throw new ConvexError(
        'Active, paused, and archived projects cannot consider names'
      );
    }
  }

  // Validate GitHub repo format (owner/repo)
  if (args.githubRepo) {
    const githubRepoRegex = /^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+$/;
    if (!githubRepoRegex.test(args.githubRepo)) {
      throw new ConvexError(
        'GitHub repo must be in format: owner/repo (e.g., facebook/react)'
      );
    }
  }

  // Validate production URL format
  if (args.productionUrl && !isValidUrl(args.productionUrl)) {
    throw new ConvexError('Invalid production URL format');
  }
}

/**
 * Create a new project with validation
 * Validates business rules before creating
 */
export const createProject = mutation({
  args: {
    status: v.union(
      v.literal('idea'),
      v.literal('active'),
      v.literal('paused'),
      v.literal('archived')
    ),
    nameId: v.optional(v.id('names')),
    consideringNameIds: v.array(v.id('names')),
    description: v.optional(v.string()),
    githubRepo: v.optional(v.string()),
    productionUrl: v.optional(v.string()),
    tags: v.array(v.string()),
  },
  handler: async (ctx, args): Promise<Id<'projects'>> => {
    // Validate business rules
    validateProjectRules({
      status: args.status,
      nameId: args.nameId,
      consideringNameIds: args.consideringNameIds,
      githubRepo: args.githubRepo,
      productionUrl: args.productionUrl,
    });

    const now = Date.now();

    // Create project
    const projectId = await ctx.db.insert('projects', {
      status: args.status,
      nameId: args.nameId,
      consideringNameIds: args.consideringNameIds,
      description: args.description,
      githubRepo: args.githubRepo,
      productionUrl: args.productionUrl,
      tags: args.tags,
      createdAt: now,
      updatedAt: now,
    });

    // TODO: Call ProjectNameLinker to link names (when implemented)
    // await ctx.runMutation(internal.projectNameLinker.linkNamesToProject, {
    //   projectId,
    //   nameId: args.nameId,
    //   consideringNameIds: args.consideringNameIds,
    // });

    return projectId;
  },
});

/**
 * Update an existing project with validation
 * Validates changes and updates timestamps
 */
export const updateProject = mutation({
  args: {
    projectId: v.id('projects'),
    status: v.optional(
      v.union(
        v.literal('idea'),
        v.literal('active'),
        v.literal('paused'),
        v.literal('archived')
      )
    ),
    nameId: v.optional(v.id('names')),
    consideringNameIds: v.optional(v.array(v.id('names'))),
    description: v.optional(v.string()),
    githubRepo: v.optional(v.string()),
    productionUrl: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args): Promise<void> => {
    const existing = await ctx.db.get(args.projectId);
    if (!existing) {
      throw new ConvexError('Project not found');
    }

    // Build updated project data
    const updated = {
      status: args.status ?? existing.status,
      nameId: args.nameId ?? existing.nameId,
      consideringNameIds: args.consideringNameIds ?? existing.consideringNameIds,
      githubRepo: args.githubRepo ?? existing.githubRepo,
      productionUrl: args.productionUrl ?? existing.productionUrl,
    };

    // Validate business rules with updated data
    validateProjectRules(updated);

    // Update project with new timestamp
    await ctx.db.patch(args.projectId, {
      ...(args.status !== undefined && { status: args.status }),
      ...(args.nameId !== undefined && { nameId: args.nameId }),
      ...(args.consideringNameIds !== undefined && {
        consideringNameIds: args.consideringNameIds,
      }),
      ...(args.description !== undefined && { description: args.description }),
      ...(args.githubRepo !== undefined && { githubRepo: args.githubRepo }),
      ...(args.productionUrl !== undefined && {
        productionUrl: args.productionUrl,
      }),
      ...(args.tags !== undefined && { tags: args.tags }),
      updatedAt: Date.now(),
    });

    // TODO: Handle name linking updates (when ProjectNameLinker implemented)
    // if (args.status && args.status !== existing.status) {
    //   await ctx.runMutation(internal.projectNameLinker.handleStatusChange, {
    //     projectId: args.projectId,
    //     oldStatus: existing.status,
    //     newStatus: args.status,
    //   });
    // }
  },
});

/**
 * Delete a project
 * Optionally releases assigned names back to pool
 */
export const deleteProject = mutation({
  args: {
    projectId: v.id('projects'),
    releaseNames: v.boolean(),
  },
  handler: async (ctx, args): Promise<void> => {
    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new ConvexError('Project not found');
    }

    // TODO: Release names via ProjectNameLinker (when implemented)
    // if (args.releaseNames) {
    //   await ctx.runMutation(internal.projectNameLinker.releaseProjectNames, {
    //     projectId: args.projectId,
    //     releaseToPool: args.releaseNames,
    //   });
    // }

    // Delete project
    await ctx.db.delete(args.projectId);
  },
});
