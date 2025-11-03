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
export const projectFormSchema = z
  .object({
    status: z.enum(['idea', 'active', 'paused', 'archived']),
    nameId: z.string().optional(),
    consideringNameIds: z.array(z.string()),
    description: z.string().optional(),
    githubRepo: z
      .string()
      .regex(
        /^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+$/,
        'Must be in format: owner/repo (e.g., facebook/react)'
      )
      .optional()
      .or(z.literal('')),
    productionUrl: z
      .string()
      .url('Must be a valid URL')
      .optional()
      .or(z.literal('')),
    tags: z.array(z.string()),
  })
  .refine(
    (data) => {
      // Business rule: active/paused/archived must have nameId
      if (data.status !== 'idea' && !data.nameId) {
        return false;
      }
      return true;
    },
    {
      message: 'Active, paused, and archived projects must have an assigned name',
      path: ['nameId'],
    }
  );

export type ProjectFormValues = z.infer<typeof projectFormSchema>;
