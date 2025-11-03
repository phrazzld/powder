import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  names: defineTable({
    name: v.string(),
    status: v.union(
      v.literal('available'),
      v.literal('assigned'),
      v.literal('considering')
    ),
    assignedTo: v.optional(v.id('projects')),
    notes: v.optional(v.string()),
  })
    .index('by_name', ['name'])
    .index('by_status', ['status'])
    .index('by_project', ['assignedTo']),

  projects: defineTable({
    nameId: v.optional(v.id('names')),
    consideringNameIds: v.array(v.id('names')),
    description: v.optional(v.string()),
    githubRepo: v.optional(v.string()),
    productionUrl: v.optional(v.string()),
    status: v.union(
      v.literal('idea'),
      v.literal('active'),
      v.literal('paused'),
      v.literal('archived')
    ),
    tags: v.array(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_status', ['status'])
    .index('by_name', ['nameId'])
    .index('by_created', ['createdAt'])
    .index('by_updated', ['updatedAt']),
});
