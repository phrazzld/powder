# Powder - Architecture Design Document

> Transforming TASK.md (WHAT/WHY) into concrete implementation blueprint (HOW)

**Version:** 0.1 MVP
**Date:** 2025-11-02
**Architect:** Claude (IQ 165 system architect)
**Status:** Ready for implementation

---

## Executive Summary

**Problem**: Manual project management via markdown is slow. Need web UI with intelligent name pool management.

**Selected Architecture**: **Modular monolith** with clear separation between Convex backend (data + business logic) and Next.js frontend (UI + presentation).

**Why This Wins**: Simplest architecture that meets requirements. Leverages Convex's built-in reactivity and E2E TypeScript. Clear module boundaries enable independent testing and future extraction if needed.

**Complexity Hidden**: Name state machine transitions, atomic project-name linking, business rule enforcement, form validation, table interactions.

**Complexity Exposed**: Simple interfaces for CRUD operations, clear data flow, explicit dependencies.

---

## Architecture Overview

### Selected Approach

**Modular Monolith with Domain-Driven Design**

- **Backend (Convex)**: Three domain modules with clear responsibilities
- **Frontend (Next.js 16)**: Server Components for data fetching, Client Components for interactivity
- **Communication**: Direct Convex hooks (useQuery, useMutation) - no middle layer
- **State Management**: Convex as single source of truth, React Query under the hood

### Core Modules

```
┌─────────────────────────────────────────────────────────────┐
│                    Next.js Frontend                         │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │  Dashboard   │  │ ProjectForm  │  │  StatusFilter   │  │
│  │   (Server)   │  │  (Client)    │  │   (Client)      │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬────────┘  │
│         │                  │                    │            │
│         └──────────────────┼────────────────────┘            │
│                            │                                 │
│                    useQuery / useMutation                    │
│                            │                                 │
└────────────────────────────┼─────────────────────────────────┘
                             │
┌────────────────────────────┼─────────────────────────────────┐
│                    Convex Backend                            │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │ NameManager  │  │ProjectManager│  │ProjectNameLinker│  │
│  │              │  │              │  │                 │  │
│  │ - CRUD names │  │ - CRUD proj  │  │ - Link/unlink   │  │
│  │ - State      │  │ - Validation │  │ - Atomic txns   │  │
│  │   machine    │  │ - Queries    │  │ - Promotion     │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬────────┘  │
│         │                  │                    │            │
│         └──────────────────┼────────────────────┘            │
│                            │                                 │
│                      Convex Database                         │
│                   ┌────────┴─────────┐                      │
│                   │ names | projects │                      │
│                   └──────────────────┘                      │
└──────────────────────────────────────────────────────────────┘
```

### Data Flow

**Read Flow (Dashboard)**:
```
User → Dashboard Page (SSR) → useQuery(listProjects)
  → Convex Query → Database → enrichWithNames()
  → Return ProjectWithName[] → Render Table
```

**Write Flow (Create Project)**:
```
User → ProjectForm → Submit → useMutation(createProject)
  → Convex Mutation → Validate → linkNamesToProject()
  → Update names table + projects table (atomic)
  → Return success → Invalidate queries → UI updates
```

**Complex Flow (Idea → Active)**:
```
User → Edit Form → Change status to "active" → Pick one name
  → useMutation(promoteIdeaToActive)
  → Convex Mutation:
     1. Validate (idea must have consideringNameIds)
     2. Unlink all considering names (set to "available")
     3. Link chosen name (set to "assigned")
     4. Update project (set nameId, clear consideringNameIds)
  → Return success → UI updates
```

### Key Design Decisions

| Decision | Rationale | Alternative Considered |
|----------|-----------|------------------------|
| Convex for backend | Built-in reactivity, E2E types, serverless, no REST layer | tRPC (adds complexity), Supabase (less type-safe) |
| Direct Convex hooks | Simplest integration, no middleware | React Query wrapper (unnecessary duplication) |
| Separate linking module | Complex logic deserves its own module | Inline in ProjectManager (violates SRP) |
| Server Components for pages | Fast initial load, SEO-friendly | Client-only (slower, no SSR benefits) |
| React Hook Form + Zod | Industry standard, type-safe | Formik (older), manual validation (error-prone) |
| shadcn/ui + TanStack Table | Modern, customizable, no bundle bloat | Material UI (heavy), Ant Design (opinionated) |

---

## Module 1: NameManager (Convex Backend)

### Responsibility

Manages the name pool lifecycle: creation, state transitions, and queries. Hides the complexity of the name state machine and ensures names are always in a valid state.

### Public Interface

```typescript
// convex/names.ts
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ============ Queries ============

export const listNames = query({
  args: {
    status: v.optional(v.union(
      v.literal("available"),
      v.literal("assigned"),
      v.literal("considering")
    )),
  },
  handler: async (ctx, args): Promise<Name[]> => {
    // Returns all names, optionally filtered by status
  },
});

export const getAvailableNames = query({
  args: {},
  handler: async (ctx): Promise<Name[]> => {
    // Returns only names with status === "available"
    // Used for: Form dropdowns, name selection
  },
});

export const getName = query({
  args: { nameId: v.id("names") },
  handler: async (ctx, args): Promise<Name | null> => {
    // Returns single name by ID
  },
});

// ============ Mutations ============

export const createName = mutation({
  args: {
    name: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"names">> => {
    // Creates name with status "available"
    // Validates: name is unique
    // Returns: nameId
  },
});

export const updateNameNotes = mutation({
  args: {
    nameId: v.id("names"),
    notes: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    // Updates notes field only
    // Used for: Adding context about name inspiration
  },
});

// Internal use only (not exported to client)
export const _transitionNameState = mutation({
  args: {
    nameId: v.id("names"),
    toStatus: v.union(
      v.literal("available"),
      v.literal("assigned"),
      v.literal("considering")
    ),
    assignedTo: v.optional(v.id("projects")),
  },
  handler: async (ctx, args): Promise<void> => {
    // Validates state transition is legal
    // Updates name status + assignedTo atomically
    // Called by: ProjectNameLinker only
  },
});
```

### Internal Implementation (Hidden)

**Name State Machine**:
```
available ─────► considering ─────► assigned
    ▲                 │                  │
    │                 │                  │
    └─────────────────┴──────────────────┘
        (release back to pool)
```

**State Transition Rules**:
- `available → considering`: When added to idea's consideringNameIds
- `considering → assigned`: When idea becomes active and picks this name
- `considering → available`: When removed from idea, or idea deleted
- `assigned → available`: When project deleted and name released
- `assigned → assigned`: Never (can't reassign to different project)

**Uniqueness Validation**:
- Check `names` index `by_name` before insert
- Throw ConvexError if duplicate

### Dependencies

- **Requires**: Convex database
- **Used by**: ProjectNameLinker, Dashboard (for name selection), Import script

### Data Structures

```typescript
type Name = {
  _id: Id<"names">;
  name: string;
  status: "available" | "assigned" | "considering";
  assignedTo?: Id<"projects">; // Only set when status === "assigned"
  notes?: string;
};
```

### Error Handling

- `DuplicateNameError`: Name already exists → return clear error message
- `InvalidStateTransition`: Attempted illegal transition → log + throw
- `OrphanedAssignment`: assignedTo points to deleted project → auto-fix on query

---

## Module 2: ProjectManager (Convex Backend)

### Responsibility

Manages project CRUD operations and enforces business rules. Hides validation logic and query complexity.

### Public Interface

```typescript
// convex/projects.ts
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ============ Queries ============

export const listProjects = query({
  args: {
    status: v.optional(v.union(
      v.literal("idea"),
      v.literal("active"),
      v.literal("paused"),
      v.literal("archived")
    )),
    search: v.optional(v.string()),
    sortBy: v.optional(v.union(
      v.literal("createdAt"),
      v.literal("updatedAt"),
      v.literal("name")
    )),
    sortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
  },
  handler: async (ctx, args): Promise<ProjectWithName[]> => {
    // Returns projects with name data joined
    // Filters by status if provided
    // Searches name + description if search provided
    // Sorts by specified field
  },
});

export const getProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args): Promise<ProjectWithName | null> => {
    // Returns single project with name data
    // Returns null if not found
  },
});

export const getProjectStats = query({
  args: {},
  handler: async (ctx): Promise<ProjectStats> => {
    // Returns counts per status
    // Used for: Dashboard stats overview
  },
});

// ============ Mutations ============

export const createProject = mutation({
  args: {
    status: v.union(
      v.literal("idea"),
      v.literal("active"),
      v.literal("paused"),
      v.literal("archived")
    ),
    nameId: v.optional(v.id("names")),
    consideringNameIds: v.array(v.id("names")),
    description: v.optional(v.string()),
    githubRepo: v.optional(v.string()),
    productionUrl: v.optional(v.string()),
    tags: v.array(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"projects">> => {
    // Validates business rules
    // Creates project
    // Calls ProjectNameLinker to link names
    // Returns projectId
  },
});

export const updateProject = mutation({
  args: {
    projectId: v.id("projects"),
    status: v.optional(v.union(
      v.literal("idea"),
      v.literal("active"),
      v.literal("paused"),
      v.literal("archived")
    )),
    nameId: v.optional(v.id("names")),
    consideringNameIds: v.optional(v.array(v.id("names"))),
    description: v.optional(v.string()),
    githubRepo: v.optional(v.string()),
    productionUrl: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args): Promise<void> => {
    // Validates changes
    // If status changed: call ProjectNameLinker.handleStatusChange()
    // If names changed: call ProjectNameLinker.updateNames()
    // Updates project
  },
});

export const deleteProject = mutation({
  args: {
    projectId: v.id("projects"),
    releaseNames: v.boolean(), // Should we release assigned names?
  },
  handler: async (ctx, args): Promise<void> => {
    // Calls ProjectNameLinker.releaseNames()
    // Deletes project
  },
});
```

### Internal Implementation (Hidden)

**Business Rule Validation**:
```typescript
function validateProjectRules(project: ProjectInput): void {
  if (project.status === "idea") {
    // Ideas: nameId must be null, consideringNameIds can be any
    if (project.nameId !== undefined) {
      throw new ConvexError("Ideas cannot have assigned name");
    }
  } else {
    // Active/paused/archived: must have nameId, consideringNameIds must be empty
    if (!project.nameId) {
      throw new ConvexError("Active/paused/archived projects must have a name");
    }
    if (project.consideringNameIds.length > 0) {
      throw new ConvexError("Active/paused/archived cannot consider names");
    }
  }

  // GitHub repo format validation
  if (project.githubRepo && !/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+$/.test(project.githubRepo)) {
    throw new ConvexError("GitHub repo must be in format: owner/repo");
  }

  // Production URL validation
  if (project.productionUrl && !isValidUrl(project.productionUrl)) {
    throw new ConvexError("Invalid production URL");
  }
}
```

**Query Optimization**:
- Use `by_status` index for status filters
- Use `by_updated` index for sorting
- Batch name lookups to minimize queries

**Search Implementation**:
- Full-text search on name + description (client-side filter for MVP)
- Future: Convex search index on description field

### Dependencies

- **Requires**: NameManager, ProjectNameLinker, Convex database
- **Used by**: Frontend forms, Dashboard, Import script

### Data Structures

```typescript
type Project = {
  _id: Id<"projects">;
  nameId?: Id<"names">;
  consideringNameIds: Id<"names">[];
  description?: string;
  githubRepo?: string;
  productionUrl?: string;
  status: "idea" | "active" | "paused" | "archived";
  tags: string[];
  createdAt: number;
  updatedAt: number;
};

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
```

### Error Handling

- `ValidationError`: Business rules violated → return detailed error
- `NotFoundError`: Project doesn't exist → return null from queries
- `NameConflict`: Trying to assign already-assigned name → clear error message

---

## Module 3: ProjectNameLinker (Convex Backend)

### Responsibility

Handles all operations that modify both `names` and `projects` tables. Ensures atomic updates and maintains referential integrity. This is the most complex module.

### Public Interface

```typescript
// convex/projectNameLinker.ts
import { v } from "convex/values";
import { mutation } from "./_generated/server";

export const linkNamesToProject = mutation({
  args: {
    projectId: v.id("projects"),
    status: v.union(
      v.literal("idea"),
      v.literal("active"),
      v.literal("paused"),
      v.literal("archived")
    ),
    nameId: v.optional(v.id("names")),
    consideringNameIds: v.array(v.id("names")),
  },
  handler: async (ctx, args): Promise<void> => {
    // Links names to project based on status
    // Atomic transaction across both tables
  },
});

export const updateProjectNames = mutation({
  args: {
    projectId: v.id("projects"),
    oldNameId: v.optional(v.id("names")),
    newNameId: v.optional(v.id("names")),
    oldConsideringNameIds: v.array(v.id("names")),
    newConsideringNameIds: v.array(v.id("names")),
  },
  handler: async (ctx, args): Promise<void> => {
    // Handles name changes
    // Releases old names, links new names
  },
});

export const promoteIdeaToActive = mutation({
  args: {
    projectId: v.id("projects"),
    chosenNameId: v.id("names"),
  },
  handler: async (ctx, args): Promise<void> => {
    // Promotes idea to active status
    // Validates chosenNameId is in consideringNameIds
    // Releases all considering names except chosen
    // Assigns chosen name
    // Updates project status
  },
});

export const releaseProjectNames = mutation({
  args: {
    projectId: v.id("projects"),
    releaseToPool: v.boolean(),
  },
  handler: async (ctx, args): Promise<void> => {
    // Releases all names linked to project
    // If releaseToPool: set status to "available"
    // If not: set status to "considering" (keep warm)
  },
});

export const handleStatusChange = mutation({
  args: {
    projectId: v.id("projects"),
    oldStatus: v.union(
      v.literal("idea"),
      v.literal("active"),
      v.literal("paused"),
      v.literal("archived")
    ),
    newStatus: v.union(
      v.literal("idea"),
      v.literal("active"),
      v.literal("paused"),
      v.literal("archived")
    ),
  },
  handler: async (ctx, args): Promise<void> => {
    // Handles status changes that affect name relationships
    // Example: active → paused (no change to names)
    // Example: active → idea (must prompt user in UI)
  },
});
```

### Internal Implementation (Hidden)

**Atomic Linking Algorithm**:
```pseudocode
function linkNamesToProject(projectId, status, nameId, consideringNameIds):
  transaction:
    if status === "idea":
      // Idea: link considering names
      for each nameId in consideringNameIds:
        name = db.get(nameId)
        if name.status === "assigned":
          throw Error("Name already assigned to another project")

        // Set name to "considering"
        db.patch(nameId, {
          status: "considering",
          assignedTo: undefined
        })

    else: // active/paused/archived
      // Must have exactly one assigned name
      if not nameId:
        throw Error("Active projects must have a name")

      name = db.get(nameId)
      if name.status === "assigned" and name.assignedTo !== projectId:
        throw Error("Name already assigned to another project")

      // Set name to "assigned"
      db.patch(nameId, {
        status: "assigned",
        assignedTo: projectId
      })
```

**Promotion Algorithm (Idea → Active)**:
```pseudocode
function promoteIdeaToActive(projectId, chosenNameId):
  transaction:
    project = db.get(projectId)

    // Validate
    if project.status !== "idea":
      throw Error("Can only promote ideas")
    if chosenNameId not in project.consideringNameIds:
      throw Error("Chosen name not being considered")

    // Release all considering names except chosen
    for each nameId in project.consideringNameIds:
      if nameId !== chosenNameId:
        db.patch(nameId, {
          status: "available",
          assignedTo: undefined
        })

    // Assign chosen name
    db.patch(chosenNameId, {
      status: "assigned",
      assignedTo: projectId
    })

    // Update project
    db.patch(projectId, {
      status: "active",
      nameId: chosenNameId,
      consideringNameIds: [],
      updatedAt: Date.now()
    })
```

**Release Algorithm**:
```pseudocode
function releaseProjectNames(projectId, releaseToPool):
  transaction:
    project = db.get(projectId)

    // Release assigned name
    if project.nameId:
      newStatus = releaseToPool ? "available" : "considering"
      db.patch(project.nameId, {
        status: newStatus,
        assignedTo: undefined
      })

    // Release considering names
    for each nameId in project.consideringNameIds:
      db.patch(nameId, {
        status: "available",
        assignedTo: undefined
      })
```

### Dependencies

- **Requires**: NameManager (for _transitionNameState), Convex database
- **Used by**: ProjectManager (during create/update/delete)

### Error Handling

- `NameAlreadyAssignedError`: Name is assigned to different project → clear error
- `InvalidPromotionError`: Trying to promote non-idea → clear error
- `TransactionFailedError`: Atomic update failed → rollback + retry

---

## Module 4: Dashboard (Next.js Frontend - Server Component)

### Responsibility

Renders the main project list page with filtering, search, and sorting. Fetches data server-side for fast initial load.

### Public Interface

```typescript
// app/page.tsx
import { ProjectTable } from "@/components/project-table";
import { StatusFilter } from "@/components/status-filter";
import { SearchBar } from "@/components/search-bar";
import { StatsOverview } from "@/components/stats-overview";
import { Button } from "@/components/ui/button";

type PageProps = {
  searchParams: {
    status?: "idea" | "active" | "paused" | "archived";
    search?: string;
    sortBy?: "createdAt" | "updatedAt" | "name";
    sortOrder?: "asc" | "desc";
  };
};

export default async function DashboardPage({ searchParams }: PageProps) {
  // Server-side data fetching
  // Returns: JSX with table, filters, search
}
```

### Internal Implementation (Hidden)

**Server-Side Data Fetching**:
```typescript
// app/page.tsx
import { preloadQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

export default async function DashboardPage({ searchParams }: PageProps) {
  // Preload data on server for fast initial render
  const preloadedProjects = await preloadQuery(api.projects.listProjects, {
    status: searchParams.status,
    search: searchParams.search,
    sortBy: searchParams.sortBy || "updatedAt",
    sortOrder: searchParams.sortOrder || "desc",
  });

  const preloadedStats = await preloadQuery(api.projects.getProjectStats, {});

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Projects</h1>
        <Button asChild>
          <Link href="/projects/new">Add Project</Link>
        </Button>
      </div>

      <StatsOverview preloadedStats={preloadedStats} />

      <div className="flex gap-4 mb-6">
        <SearchBar defaultValue={searchParams.search} />
        <StatusFilter activeStatus={searchParams.status} />
      </div>

      <ProjectTable preloadedProjects={preloadedProjects} />
    </div>
  );
}
```

**URL State Management**:
- Read filters from `searchParams`
- Update URL on filter change (Client Component handles this)
- Enables: shareable URLs, back/forward navigation

### Dependencies

- **Requires**: ProjectTable, StatusFilter, SearchBar, StatsOverview, Convex queries
- **Used by**: N/A (root page)

### Data Flow

```
User visits "/"
  → Next.js renders page.tsx (server)
  → preloadQuery(listProjects) hits Convex
  → Data serialized in HTML
  → Client hydrates
  → ProjectTable (Client) uses preloaded data
  → User changes filter
  → Client updates URL (?status=active)
  → Page re-renders on server with new params
```

---

## Module 5: ProjectForm (Next.js Frontend - Client Component)

### Responsibility

Handles add/edit project forms with validation, status-dependent fields, and optimistic updates.

### Public Interface

```typescript
// components/project-form.tsx
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

type ProjectFormProps = {
  projectId?: Id<"projects">; // If editing
  onSuccess?: () => void;
  onCancel?: () => void;
};

export function ProjectForm({ projectId, onSuccess, onCancel }: ProjectFormProps) {
  // Returns: Form with status-dependent fields, validation, submit handling
}
```

### Internal Implementation (Hidden)

**Form Schema (Zod)**:
```typescript
// lib/validation.ts
import { z } from "zod";

export const projectFormSchema = z.object({
  status: z.enum(["idea", "active", "paused", "archived"]),
  nameId: z.string().optional(),
  consideringNameIds: z.array(z.string()),
  description: z.string().optional(),
  githubRepo: z
    .string()
    .regex(/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+$/, "Must be in format: owner/repo")
    .optional()
    .or(z.literal("")),
  productionUrl: z.string().url().optional().or(z.literal("")),
  tags: z.array(z.string()),
}).refine((data) => {
  // Business rule: active/paused/archived must have nameId
  if (data.status !== "idea" && !data.nameId) {
    return false;
  }
  return true;
}, {
  message: "Active/paused/archived projects must have a name",
  path: ["nameId"],
});

export type ProjectFormValues = z.infer<typeof projectFormSchema>;
```

**Form Component**:
```typescript
// components/project-form.tsx
export function ProjectForm({ projectId, onSuccess, onCancel }: ProjectFormFormProps) {
  const createProject = useMutation(api.projects.createProject);
  const updateProject = useMutation(api.projects.updateProject);
  const { data: availableNames } = useQuery(api.names.getAvailableNames);
  const { data: existingProject } = useQuery(
    api.projects.getProject,
    projectId ? { projectId } : "skip"
  );

  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: existingProject || {
      status: "idea",
      nameId: undefined,
      consideringNameIds: [],
      description: "",
      githubRepo: "",
      productionUrl: "",
      tags: [],
    },
  });

  const status = form.watch("status");

  async function onSubmit(values: ProjectFormValues) {
    try {
      if (projectId) {
        await updateProject({ projectId, ...values });
      } else {
        await createProject(values);
      }
      onSuccess?.();
    } catch (error) {
      // Show error toast
      console.error(error);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Status field */}
        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Status</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="idea">Idea</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </FormItem>
          )}
        />

        {/* Name field - conditional on status */}
        {status === "idea" ? (
          <FormField
            control={form.control}
            name="consideringNameIds"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Considering Names (optional)</FormLabel>
                <MultiSelect
                  options={availableNames?.map(n => ({ value: n._id, label: n.name })) || []}
                  value={field.value}
                  onChange={field.onChange}
                />
              </FormItem>
            )}
          />
        ) : (
          <FormField
            control={form.control}
            name="nameId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name (required)</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select name" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableNames?.map(name => (
                      <SelectItem key={name._id} value={name._id}>
                        {name.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* Other fields... */}

        <div className="flex gap-2">
          <Button type="submit">Save</Button>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  );
}
```

**Status-Dependent Logic**:
- Idea: Show multi-select for `consideringNameIds`
- Active/paused/archived: Show single select for `nameId` (required)
- Disable name field if status is being changed from idea → active (prompt promotion flow instead)

**Optimistic Updates**:
- Not implemented in MVP (Convex handles reactivity)
- Future: optimistic update on submit, rollback on error

### Dependencies

- **Requires**: React Hook Form, Zod, Convex mutations, shadcn Form components
- **Used by**: /projects/new, /projects/[id]

### Error Handling

- Validation errors: Inline under fields (FormMessage)
- Mutation errors: Toast notification
- Network errors: Convex auto-retries

---

## Implementation Pseudocode

### Critical Algorithm: Atomic Project Creation with Name Linking

```pseudocode
// convex/projects.ts - createProject mutation
function createProject(args):
  // 1. Validate input
  validateProjectRules(args)

  // 2. Create project record (without names linked yet)
  projectId = db.insert("projects", {
    status: args.status,
    nameId: undefined,  // Set later
    consideringNameIds: [],  // Set later
    description: args.description,
    githubRepo: args.githubRepo,
    productionUrl: args.productionUrl,
    tags: args.tags,
    createdAt: Date.now(),
    updatedAt: Date.now()
  })

  // 3. Link names atomically
  // This is critical: if this fails, project exists but has no names
  // Convex mutations are transactional, so either both succeed or both fail
  try:
    await ctx.runMutation(internal.projectNameLinker.linkNamesToProject, {
      projectId: projectId,
      status: args.status,
      nameId: args.nameId,
      consideringNameIds: args.consideringNameIds
    })
  catch error:
    // If linking fails, delete the project and rethrow
    await db.delete(projectId)
    throw error

  // 4. Update project with linked name IDs
  db.patch(projectId, {
    nameId: args.nameId,
    consideringNameIds: args.consideringNameIds
  })

  return projectId
```

### Critical Algorithm: Idea Promotion to Active

```pseudocode
// convex/projectNameLinker.ts - promoteIdeaToActive mutation
function promoteIdeaToActive(projectId, chosenNameId):
  // 1. Get project and validate
  project = db.get(projectId)
  if not project:
    throw Error("Project not found")
  if project.status !== "idea":
    throw Error("Can only promote ideas to active")
  if project.consideringNameIds.length === 0:
    throw Error("Idea must have at least one considering name")
  if chosenNameId not in project.consideringNameIds:
    throw Error("Chosen name not in considering list")

  // 2. Release all considering names except chosen
  for nameId in project.consideringNameIds:
    if nameId !== chosenNameId:
      await ctx.runMutation(internal.names._transitionNameState, {
        nameId: nameId,
        toStatus: "available",
        assignedTo: undefined
      })

  // 3. Assign chosen name
  await ctx.runMutation(internal.names._transitionNameState, {
    nameId: chosenNameId,
    toStatus: "assigned",
    assignedTo: projectId
  })

  // 4. Update project (atomic)
  db.patch(projectId, {
    status: "active",
    nameId: chosenNameId,
    consideringNameIds: [],
    updatedAt: Date.now()
  })
```

### Critical Algorithm: Project Deletion with Name Release

```pseudocode
// convex/projects.ts - deleteProject mutation
function deleteProject(projectId, releaseNames):
  // 1. Get project
  project = db.get(projectId)
  if not project:
    throw Error("Project not found")

  // 2. Release names first (critical: do this before deleting project)
  await ctx.runMutation(internal.projectNameLinker.releaseProjectNames, {
    projectId: projectId,
    releaseToPool: releaseNames
  })

  // 3. Delete project
  db.delete(projectId)
```

### Search and Filter Algorithm

```pseudocode
// convex/projects.ts - listProjects query
function listProjects(args):
  // 1. Build base query
  query = db.query("projects")

  // 2. Apply status filter
  if args.status:
    query = query.withIndex("by_status", q => q.eq("status", args.status))

  // 3. Collect results
  projects = await query.collect()

  // 4. Enrich with name data
  enrichedProjects = []
  for project in projects:
    // Resolve name
    name = undefined
    if project.nameId:
      nameDoc = await db.get(project.nameId)
      name = nameDoc?.name

    // Resolve considering names
    consideringNames = []
    for nameId in project.consideringNameIds:
      nameDoc = await db.get(nameId)
      if nameDoc:
        consideringNames.push(nameDoc.name)

    enrichedProjects.push({
      ...project,
      name: name,
      consideringNames: consideringNames
    })

  // 5. Apply search filter (client-side for MVP)
  if args.search:
    searchLower = args.search.toLowerCase()
    enrichedProjects = enrichedProjects.filter(p =>
      p.name?.toLowerCase().includes(searchLower) ||
      p.description?.toLowerCase().includes(searchLower)
    )

  // 6. Sort
  if args.sortBy:
    enrichedProjects.sort((a, b) => {
      if args.sortOrder === "asc":
        return a[args.sortBy] > b[args.sortBy] ? 1 : -1
      else:
        return a[args.sortBy] < b[args.sortBy] ? 1 : -1
    })

  return enrichedProjects
```

---

## File Organization

```
powder/
├── app/
│   ├── layout.tsx                     # Root layout with ConvexProvider
│   ├── page.tsx                       # Dashboard (Server Component)
│   ├── projects/
│   │   ├── new/
│   │   │   └── page.tsx               # Add project page
│   │   └── [id]/
│   │       └── page.tsx               # Edit project page
│   └── globals.css                    # Tailwind styles
│
├── components/
│   ├── ui/                            # shadcn components (auto-generated)
│   │   ├── button.tsx
│   │   ├── form.tsx
│   │   ├── input.tsx
│   │   ├── select.tsx
│   │   ├── table.tsx
│   │   ├── dialog.tsx
│   │   ├── badge.tsx
│   │   └── ...
│   ├── project-table.tsx              # Main data table (Client Component)
│   ├── project-form.tsx               # Add/edit form (Client Component)
│   ├── status-filter.tsx              # Status tabs/dropdown
│   ├── search-bar.tsx                 # Search input with debounce
│   ├── stats-overview.tsx             # Project count cards
│   └── delete-dialog.tsx              # Confirmation dialog
│
├── convex/
│   ├── schema.ts                      # Database schema definition
│   ├── names.ts                       # NameManager (queries + mutations)
│   ├── projects.ts                    # ProjectManager (queries + mutations)
│   ├── projectNameLinker.ts           # Linking logic (mutations only)
│   ├── import.ts                      # Import script (action)
│   ├── _generated/
│   │   ├── api.d.ts                   # Auto-generated API types
│   │   ├── dataModel.d.ts             # Auto-generated data model types
│   │   └── server.d.ts                # Auto-generated server types
│   └── README.md                      # Convex-generated readme
│
├── lib/
│   ├── convex.ts                      # Convex client setup
│   ├── validation.ts                  # Zod schemas
│   └── utils.ts                       # Utility functions (cn, formatDate, etc.)
│
├── public/
│   └── (static assets)
│
├── .env.local                         # Environment variables (CONVEX_URL)
├── convex.json                        # Convex configuration
├── next.config.js                     # Next.js configuration
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── TASK.md                            # Product spec (WHAT/WHY)
├── DESIGN.md                          # This document (HOW)
└── README.md                          # Setup instructions
```

### Key Files

**Convex Backend (convex/)**:
- `schema.ts`: Single source of truth for data model
- `names.ts`: All name-related queries/mutations
- `projects.ts`: All project-related queries/mutations
- `projectNameLinker.ts`: Complex linking logic (internal use)
- `import.ts`: One-time markdown import action

**Next.js Frontend (app/)**:
- `layout.tsx`: Wraps children with ConvexProvider
- `page.tsx`: Dashboard with server-side data fetching
- `projects/new/page.tsx`: Add project form page
- `projects/[id]/page.tsx`: Edit project form page

**Reusable Components (components/)**:
- `project-table.tsx`: TanStack Table with sorting/filtering
- `project-form.tsx`: Form with validation + status-dependent fields
- `status-filter.tsx`: Filter tabs (All, Ideas, Active, Paused, Archived)
- `search-bar.tsx`: Debounced search input
- `ui/`: shadcn components (copied from registry)

---

## Integration Points

### Convex Database Schema

```typescript
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  names: defineTable({
    name: v.string(),
    status: v.union(
      v.literal("available"),
      v.literal("assigned"),
      v.literal("considering")
    ),
    assignedTo: v.optional(v.id("projects")),
    notes: v.optional(v.string()),
  })
    .index("by_name", ["name"])           // Unique name lookup
    .index("by_status", ["status"])       // Filter by status
    .index("by_project", ["assignedTo"]), // Reverse lookup

  projects: defineTable({
    nameId: v.optional(v.id("names")),
    consideringNameIds: v.array(v.id("names")),
    description: v.optional(v.string()),
    githubRepo: v.optional(v.string()),
    productionUrl: v.optional(v.string()),
    status: v.union(
      v.literal("idea"),
      v.literal("active"),
      v.literal("paused"),
      v.literal("archived")
    ),
    tags: v.array(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_name", ["nameId"])
    .index("by_created", ["createdAt"])
    .index("by_updated", ["updatedAt"]),
});
```

### Environment Variables

```bash
# .env.local
NEXT_PUBLIC_CONVEX_URL=https://xxx.convex.cloud  # From `npx convex dev`
```

### Convex Client Setup

```typescript
// app/layout.tsx
import { ConvexProvider, ConvexReactClient } from "convex/react";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ConvexProvider client={convex}>
          {children}
        </ConvexProvider>
      </body>
    </html>
  );
}
```

### External Dependencies

**NPM Packages**:
- `convex`: Backend + client
- `next`: Framework
- `react`: UI library
- `react-hook-form`: Form handling
- `@hookform/resolvers`: Zod integration
- `zod`: Validation schemas
- `@tanstack/react-table`: Table functionality
- `lucide-react`: Icons
- `tailwindcss`: Styling
- `class-variance-authority`: Variant styling
- `clsx` + `tailwind-merge`: Class merging (cn util)

**No External APIs** (for MVP):
- GitHub API: Future iteration
- OpenAI API: Future iteration

---

## State Management

### Server State (Authoritative)

**Convex Database**:
- Single source of truth
- Reactive subscriptions via useQuery
- Optimistic updates handled by Convex automatically

### Client State

**React Query (via Convex)**:
```
useQuery(api.projects.listProjects)
  → Subscribes to changes
  → Auto-updates when data changes
  → Caches results
  → Handles loading/error states
```

**Form State**:
```
React Hook Form
  → Local form state
  → Validation via Zod
  → Dirty checking
  → Error messages
```

**URL State**:
```
searchParams (Next.js App Router)
  → Status filter (?status=active)
  → Search query (?search=powder)
  → Sort params (?sortBy=updatedAt&sortOrder=desc)
```

### State Update Flow

**Read Flow**:
```
Component renders
  → useQuery(api.projects.listProjects, { status: "active" })
  → Convex establishes WebSocket subscription
  → Initial data fetched
  → Component re-renders with data
  → Backend updates database
  → Convex pushes update over WebSocket
  → useQuery invalidates + refetches
  → Component re-renders with new data
```

**Write Flow (No Optimistic Updates)**:
```
User submits form
  → useMutation(api.projects.createProject)
  → Loading state shown
  → Mutation sent to Convex
  → Convex validates + writes to database
  → Mutation completes
  → Convex pushes update to all subscribers
  → useQuery refetches
  → UI updates with new data
```

**Write Flow (With Optimistic Updates - Future)**:
```
User submits form
  → useMutation with optimistic update
  → UI immediately updates (optimistic)
  → Mutation sent to Convex
  → If success: keep optimistic update
  → If error: rollback optimistic update + show error
```

---

## Error Handling Strategy

### Error Categories

**1. Validation Errors (Client-Side)**:
- Zod schema validation fails
- Display: Inline under form field (FormMessage)
- Example: "GitHub repo must be in format: owner/repo"

**2. Business Logic Errors (Convex)**:
- Business rules violated (e.g., idea without name trying to go active)
- Display: Toast notification
- Example: "Active projects must have a name"

**3. Name Conflicts (Convex)**:
- Trying to assign already-assigned name
- Display: Toast notification with suggestion
- Example: "Name 'powder' is already assigned to project 'X'. Choose a different name."

**4. Network Errors (Convex Client)**:
- Connection lost, request timeout
- Handling: Convex auto-retries with exponential backoff
- Display: Toast if retry fails after 3 attempts
- Example: "Connection lost. Retrying..."

**5. Database Errors (Convex)**:
- Rare: database unavailable, corrupted data
- Handling: Log to console, show generic error
- Display: Toast with "Something went wrong. Try again."

### Error Response Format

```typescript
// Convex mutations throw ConvexError
import { ConvexError } from "convex/values";

throw new ConvexError({
  code: "NAME_ALREADY_ASSIGNED",
  message: "Name 'powder' is already assigned to another project",
  nameId: "abc123",
  assignedTo: "xyz789"
});
```

**Client Handling**:
```typescript
const createProject = useMutation(api.projects.createProject);

async function onSubmit(values: ProjectFormValues) {
  try {
    await createProject(values);
    toast.success("Project created!");
  } catch (error) {
    if (error instanceof ConvexError) {
      toast.error(error.data.message);
    } else {
      toast.error("Something went wrong. Please try again.");
    }
  }
}
```

### Logging

**Development**:
- All errors logged to console
- Convex dashboard shows mutation errors

**Production**:
- Convex errors logged to Convex dashboard
- Frontend errors: Consider adding Sentry (future)

---

## Testing Strategy

### Unit Tests

**What to Test**:
- Name state machine transitions (NameManager)
- Project validation logic (ProjectManager)
- Zod schemas (lib/validation.ts)
- Utility functions (lib/utils.ts)

**How to Test**:
```typescript
// convex/names.test.ts
import { convexTest } from "convex-test";
import { api } from "./_generated/api";
import schema from "./schema";

describe("NameManager", () => {
  test("createName creates available name", async () => {
    const t = convexTest(schema);

    const nameId = await t.mutation(api.names.createName, {
      name: "powder",
      notes: "Potential energy",
    });

    const name = await t.query(api.names.getName, { nameId });
    expect(name?.status).toBe("available");
    expect(name?.assignedTo).toBeUndefined();
  });

  test("createName rejects duplicate name", async () => {
    const t = convexTest(schema);

    await t.mutation(api.names.createName, { name: "powder" });

    await expect(
      t.mutation(api.names.createName, { name: "powder" })
    ).rejects.toThrow("Name already exists");
  });
});
```

### Integration Tests

**What to Test**:
- Full CRUD flows (create project → link names → delete project)
- Idea promotion to active
- Name release on project deletion
- Query filtering and search

**How to Test**:
```typescript
// convex/integration.test.ts
describe("Project-Name Integration", () => {
  test("creating active project assigns name", async () => {
    const t = convexTest(schema);

    // Setup
    const nameId = await t.mutation(api.names.createName, { name: "powder" });

    // Create active project
    const projectId = await t.mutation(api.projects.createProject, {
      status: "active",
      nameId: nameId,
      consideringNameIds: [],
      description: "Test project",
      tags: [],
    });

    // Verify name is assigned
    const name = await t.query(api.names.getName, { nameId });
    expect(name?.status).toBe("assigned");
    expect(name?.assignedTo).toBe(projectId);
  });

  test("promoting idea to active releases unconsidered names", async () => {
    const t = convexTest(schema);

    // Setup: create 2 names
    const nameId1 = await t.mutation(api.names.createName, { name: "powder" });
    const nameId2 = await t.mutation(api.names.createName, { name: "spark" });

    // Create idea considering both
    const projectId = await t.mutation(api.projects.createProject, {
      status: "idea",
      consideringNameIds: [nameId1, nameId2],
      description: "Test idea",
      tags: [],
    });

    // Promote to active, choose nameId1
    await t.mutation(api.projectNameLinker.promoteIdeaToActive, {
      projectId: projectId,
      chosenNameId: nameId1,
    });

    // Verify nameId1 is assigned, nameId2 is available
    const name1 = await t.query(api.names.getName, { nameId: nameId1 });
    const name2 = await t.query(api.names.getName, { nameId: nameId2 });

    expect(name1?.status).toBe("assigned");
    expect(name2?.status).toBe("available");
  });
});
```

### E2E Tests (Playwright - Future)

**What to Test**:
- Dashboard loads and displays projects
- Creating project via form
- Editing project
- Deleting project with confirmation
- Search and filter interactions
- Idea → active promotion flow

**Example Test**:
```typescript
// e2e/dashboard.spec.ts
import { test, expect } from "@playwright/test";

test("create new project", async ({ page }) => {
  await page.goto("/");
  await page.click('text="Add Project"');

  await page.fill('input[name="status"]', "active");
  await page.selectOption('select[name="nameId"]', { label: "powder" });
  await page.fill('textarea[name="description"]', "Test project");

  await page.click('button[type="submit"]');

  await expect(page.locator('text="Test project"')).toBeVisible();
});
```

### Mocking Strategy

**Minimize Mocking**:
- Use Convex test utility (convexTest) for backend tests
- Convex provides in-memory database for tests
- No need to mock database or Convex functions

**When to Mock**:
- External APIs (GitHub, OpenAI) in future iterations
- Browser APIs (localStorage) in frontend unit tests

---

## Performance Considerations

### Expected Load (MVP)

- **Users**: 1 (solo developer)
- **Projects**: ~60 initially, max 200
- **Names**: ~100
- **Queries per minute**: <10 (normal usage)
- **Mutations per minute**: <5 (normal usage)

**Performance Targets**:
- Dashboard load: <500ms
- Search/filter: <100ms (client-side)
- Form submit: <200ms (round-trip to Convex)
- Query updates: <50ms (Convex push)

### Optimizations

**Database Indexes**:
- `by_name` on names table (unique lookup)
- `by_status` on projects table (filter queries)
- `by_updated` on projects table (default sort)

**Query Optimization**:
- Fetch only needed fields (Convex returns full docs, no N+1 problem)
- Batch name lookups in listProjects (single pass, no repeated queries)

**Client-Side**:
- Debounce search input (300ms)
- Memoize table columns (useMemo)
- Virtualized list (if >500 projects - overkill for MVP)

**Not Needed (MVP)**:
- Pagination (60 projects fit on one page)
- Caching beyond Convex default (good enough)
- CDN (static assets are minimal)
- Image optimization (no images)

### Scaling Strategy (Future)

If load increases (multiple users, 1000+ projects):

**Horizontal Scaling**:
- Convex auto-scales (serverless)
- Next.js on Vercel auto-scales

**Database Optimization**:
- Add pagination to listProjects query
- Implement Convex search index for full-text search
- Consider denormalizing name data into projects table (avoid joins)

**Client Optimization**:
- Virtual scrolling for large tables (react-virtual)
- Incremental loading (load 50 projects at a time)
- Service worker caching (offline support)

---

## Security Considerations

### Threats & Mitigation

**No Authentication (MVP)**:
- Single-user app, deployed on private URL
- Convex deployment is public-readable but write-protected by API key
- Future: Add Clerk auth if making multi-user

**Input Validation**:
- Client-side: Zod schema validation
- Server-side: Convex validators on all mutations
- SQL injection: N/A (Convex is NoSQL, no raw queries)

**XSS (Cross-Site Scripting)**:
- React automatically escapes JSX
- User input never dangerouslySetInnerHTML
- Tags/descriptions are plain text

**CSRF (Cross-Site Request Forgery)**:
- Convex uses tokens for mutations
- Next.js Server Actions have CSRF protection

**Rate Limiting**:
- Not needed for MVP (single user)
- Convex has default rate limits (1000 req/min per user)

**Data Leakage**:
- No PII in database (only project names/descriptions)
- No secrets (GitHub tokens will be encrypted in future)

### Security Best Practices

**Environment Variables**:
- CONVEX_URL in .env.local (not committed)
- Never log sensitive data

**Dependencies**:
- Regularly update npm packages
- Use `npm audit` to check for vulnerabilities

**Deployment**:
- Vercel serves over HTTPS by default
- Convex uses HTTPS for all API calls

---

## Alternative Architectures Considered

### Alternative A: Monolithic Convex (All logic in one file)

**Structure**:
```
convex/
  └── functions.ts  # All queries + mutations in one file
```

**Pros**:
- Simpler file structure
- Everything in one place

**Cons**:
- Poor separation of concerns
- Hard to test individual modules
- Violates single responsibility principle
- 500+ line file, hard to navigate

**Verdict**: ❌ **Rejected** - Violates modularity principles. As complexity grows, this becomes unmaintainable.

---

### Alternative B: Client-Side State Management (Zustand/Redux)

**Structure**:
```
Client State (Zustand)
  ↓ fetch
Convex Backend (read-only queries)
```

**Pros**:
- More control over client state
- Familiar patterns for some developers
- Can implement custom caching strategies

**Cons**:
- Duplicate state (client + server)
- Complex synchronization logic
- Convex already provides reactive state management
- More code to maintain

**Verdict**: ❌ **Rejected** - Convex's built-in reactivity is simpler and more reliable. Adding client state would duplicate complexity without clear benefit.

---

### Alternative C: tRPC Middle Layer

**Structure**:
```
Next.js
  ↓ tRPC
Convex Backend
```

**Pros**:
- Type-safe API layer
- Familiar to tRPC users
- Flexible routing

**Cons**:
- Extra abstraction layer
- Convex already provides E2E types
- More configuration needed
- Adds build complexity

**Verdict**: ❌ **Rejected** - Convex already provides E2E TypeScript. Adding tRPC adds complexity without solving any problems.

---

### Alternative D: Separate Backend Service (Express/Fastify)

**Structure**:
```
Next.js (Frontend)
  ↓ HTTP
Express API
  ↓
Convex (Database only)
```

**Pros**:
- Familiar backend architecture
- Full control over API layer
- Can add custom middleware

**Cons**:
- Need to deploy separate service
- No reactivity (need polling or WebSockets)
- More infrastructure to manage
- Slower development

**Verdict**: ❌ **Rejected** - Massive overkill for MVP. Convex backend is simpler and provides reactivity out of the box.

---

### Alternative E: GraphQL API

**Structure**:
```
Next.js + Apollo Client
  ↓ GraphQL
Convex Backend (via GraphQL gateway)
```

**Pros**:
- Flexible queries
- Industry standard
- Good tooling

**Cons**:
- Need to write GraphQL schema + resolvers
- Convex doesn't natively support GraphQL
- More complex than direct Convex hooks
- Overkill for simple CRUD

**Verdict**: ❌ **Rejected** - GraphQL adds complexity without clear benefit. Convex's query/mutation model is simpler.

---

## Selected Architecture: Modular Monolith with Direct Convex Integration

**Why This Wins**:

1. **Simplicity** (40%): Fewest concepts to understand. Direct Convex hooks, no middleware.
2. **Module Depth** (30%): Clear separation (NameManager, ProjectManager, ProjectNameLinker). Simple interfaces hiding complex state management.
3. **Explicitness** (20%): Dependencies are clear. Data flow is straightforward.
4. **Robustness** (10%): Convex handles reactivity, retries, caching. Less we can break.

**Future-Proof**:
- Clear module boundaries enable extraction to microservices if needed
- Can add tRPC layer later without major refactor
- Can add client state management (Zustand) if reactivity isn't enough
- Can migrate off Convex (replace queries/mutations, keep UI)

---

## Quality Validation Checklist

Before implementation:

**✅ Clarity**:
- [x] Can a developer implement this without making architectural decisions?
- [x] Are all interfaces concrete (no "handle authentication" vagueness)?

**✅ Completeness**:
- [x] All modules defined with responsibilities
- [x] All interfaces specified with TypeScript signatures
- [x] Critical algorithms documented in pseudocode
- [x] Data structures fully typed

**✅ Pseudocode**:
- [x] Atomic project creation algorithm
- [x] Idea promotion algorithm
- [x] Name release algorithm
- [x] Search/filter algorithm

**✅ Simplicity**:
- [x] Simplest architecture that meets requirements (modular monolith)
- [x] No premature optimization (no caching, pagination, virtualization)
- [x] No unnecessary abstractions (no tRPC, Redux, GraphQL)

**✅ Deep Modules**:
- [x] NameManager hides state machine complexity
- [x] ProjectNameLinker hides atomic transaction complexity
- [x] ProjectForm hides validation + status-dependent logic

**✅ Explicit Dependencies**:
- [x] Each module lists what it requires and who uses it
- [x] No circular dependencies
- [x] Integration points documented (Convex schema, env vars)

---

## Next Steps

1. **Review this design** with stakeholder (you)
2. **Initialize project**:
   ```bash
   npx create-next-app@latest powder --typescript --tailwind --app
   cd powder
   npm install convex
   npx convex dev
   ```
3. **Run `/plan`** to break this architecture into atomic implementation tasks
4. **Start Day 1**: Implement Convex schema + NameManager module

---

## Summary

**Architecture Selected**: Modular monolith with Convex backend + Next.js frontend

**Key Modules**:
1. **NameManager** (Convex) - Name CRUD + state machine
2. **ProjectManager** (Convex) - Project CRUD + validation
3. **ProjectNameLinker** (Convex) - Atomic linking operations
4. **Dashboard** (Next.js) - Project list UI
5. **ProjectForm** (Next.js) - Add/edit form

**Critical Design Decisions**:
- Direct Convex hooks (no middleware)
- Server Components for pages (fast initial load)
- Status-dependent form fields (UX clarity)
- Atomic transactions (data integrity)

**Complexity Hidden**:
- Name state machine transitions
- Atomic project-name linking
- Business rule enforcement
- Form validation logic

**Complexity Exposed**:
- Simple CRUD interfaces
- Clear data structures
- Explicit dependencies

**What's NOT in Scope** (saved for iteration):
- GitHub API sync
- AI features
- Real-time collaboration
- CLI access
- Analytics

**Why This Beats Alternatives**:
- Simplest architecture that works
- Leverages Convex's strengths (reactivity, types)
- Clear module boundaries for testing
- Can evolve without major refactor

---

**"Architecture is sharpening the axe. Now we know exactly how to swing it."**

Ready to implement? Run `/plan` to convert this design into atomic tasks.
