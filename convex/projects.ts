import { v } from 'convex/values';
import { query } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';

/**
 * ProjectManager Module - Queries
 *
 * Manages project queries with name enrichment and filtering.
 * Provides efficient querying with index usage and client-side search.
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
