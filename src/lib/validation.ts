import { z } from 'zod';

/**
 * Form validation schema for project create/edit
 *
 * Business rules:
 * - Ideas: no assigned name required, can have considering names
 * - Active/paused/archived: must have assigned name, no considering names
 * - GitHub repo: must be in format owner/repo
 * - Production URL: must be valid URL format
 */
const githubRepoRegex = /^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+$/;

const normalizeOptionalString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
};

export const projectFormSchema = z
  .object({
    status: z.enum(['idea', 'active', 'paused', 'archived']),
    nameId: z.string().optional(),
    consideringNameIds: z.array(z.string()).default([]),
    description: z.string().optional(),
    githubRepo: z.preprocess(
      normalizeOptionalString,
      z
        .string()
        .regex(
          githubRepoRegex,
          'Must be in format: owner/repo (e.g., facebook/react)'
        )
        .optional()
    ),
    productionUrl: z.preprocess(
      normalizeOptionalString,
      z.string().url('Must be a valid URL').optional()
    ),
    tags: z.array(z.string()).default([]),
  })
  .superRefine((data, ctx) => {
    if (data.status === 'idea') {
      if (data.nameId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['nameId'],
          message: 'Ideas cannot have an assigned name',
        });
      }
      if (data.githubRepo) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['githubRepo'],
          message: 'Ideas cannot have a GitHub repository',
        });
      }
      if (data.productionUrl) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['productionUrl'],
          message: 'Ideas cannot have a production URL',
        });
      }
      return;
    }

    if (!data.nameId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['nameId'],
        message: 'Active, paused, and archived projects must have an assigned name',
      });
    }

    if (data.consideringNameIds.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['consideringNameIds'],
        message: 'Only ideas can track considering names',
      });
    }
  });

export type ProjectFormValues = z.infer<typeof projectFormSchema>;
