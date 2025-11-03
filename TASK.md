# Powder - Product Specification

> Personal project registry with name pool management

**Version:** 0.1 MVP
**Status:** Pre-development
**Stack:** Next.js 16, TypeScript, Convex, Vercel, shadcn/ui, Tailwind CSS
**Target:** Ship in 1-2 weeks
**Created:** 2025-11-01

---

## Executive Summary

**Powder** is a web-based project registry that replaces markdown-based project management with a clean, fast UI. This MVP focuses on manual CRUD operations for projects and intelligent name pool management.

**User Value:** Faster project browsing, better name management, foundation for future automation (GitHub sync, AI features).

**Key Insight:** Projects and names have a many-to-many relationship that changes based on project lifecycle stage. Ideas can consider multiple names; active projects lock to one name.

---

## Scope: What We're Building (MVP v0.1)

### ✅ In Scope
- **Project CRUD:** Create, read, update, delete projects
- **Name Pool Management:** Track available names, names under consideration, assigned names
- **Project-Name Relationships:** Link names to projects based on status
- **Dashboard:** Clean table view with filtering, search, sorting
- **Forms:** Add/edit projects with validation
- **Import:** One-time migration from `~/Development/codex/docs/projects.md`
- **Deploy:** Vercel hosting, accessible anywhere

### ❌ Out of Scope (Future Iterations)
- GitHub API sync / auto-status detection
- AI features (GPT-5 descriptions, recommendations)
- Real-time collaboration
- CLI access
- Analytics/insights
- Export to markdown
- Project templates

---

## Core Concept: Name-Project Relationship

### The Problem
- **Names are valuable:** We curate a pool of good project names
- **Ideas are fluid:** An idea might work under several names
- **Active projects are committed:** Once built, a project owns its name
- **Names get recycled:** Archived projects can release names back to the pool

### The Solution: Two-Table Model

#### Table 1: Names (First-Class Entities)
Every name in our pool is tracked independently:

```typescript
names: {
  name: string                          // "powder", "switchboard", "arcana"
  status: "available" | "assigned" | "considering"
  assignedTo?: Id<"projects">           // if status === "assigned"
  notes?: string                        // "inspired by MTG card", etc.
}
```

**Name States:**
- **available:** In the pool, not tied to any project
- **considering:** Being considered for one or more ideas
- **assigned:** Locked to an active/paused/archived project

#### Table 2: Projects
Projects link to names differently based on their status:

```typescript
projects: {
  // Name relationship (status-dependent)
  nameId?: Id<"names">                  // ONLY for active/paused/archived
  consideringNameIds: Id<"names">[]     // ONLY for ideas

  // Core fields
  description?: string
  githubRepo?: string                   // "owner/repo" format
  productionUrl?: string                // any URL
  status: "idea" | "active" | "paused" | "archived"
  tags: string[]                        // free-form tags

  // Metadata
  createdAt: number
  updatedAt: number
}
```

### Business Rules

1. **Active/Paused/Archived Projects:**
   - MUST have exactly one `nameId`
   - `consideringNameIds` MUST be empty
   - Linked name MUST have `status: "assigned"` and `assignedTo: <this project>`

2. **Idea Projects:**
   - `nameId` MUST be null/undefined
   - Can have 0+ `consideringNameIds`
   - Each linked name MUST have `status: "considering"`

3. **Name Constraints:**
   - A name can only be `assigned` to ONE project at a time
   - A name can be `considering` for MULTIPLE ideas simultaneously
   - Name transitions:
     - `available` → `considering` (when added to idea)
     - `considering` → `assigned` (when idea becomes active and picks this name)
     - `assigned` → `available` (when project archived and name released)

### Example Flow

```
1. Idea created: "AI-powered recipe app"
   - consideringNameIds: ["sous", "chefbot"]
   - Both names: status = "considering"

2. Idea becomes active, picks "sous":
   - nameId: "sous"
   - consideringNameIds: []
   - "sous": status = "assigned", assignedTo = <project>
   - "chefbot": status = "available" (released back to pool)

3. Project archived:
   - User chooses: keep name locked OR release
   - If released: "sous": status = "available", assignedTo = null
```

---

## Data Model (Complete Schema)

### Convex Schema

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
    .index("by_name", ["name"])           // Unique lookup, enforce uniqueness
    .index("by_status", ["status"])       // Filter available names
    .index("by_project", ["assignedTo"]), // Reverse lookup: name -> project

  projects: defineTable({
    // Name relationship (mutually exclusive based on status)
    nameId: v.optional(v.id("names")),
    consideringNameIds: v.array(v.id("names")),

    // Project details
    description: v.optional(v.string()),
    githubRepo: v.optional(v.string()),     // Format: "owner/repo"
    productionUrl: v.optional(v.string()),  // Full URL
    status: v.union(
      v.literal("idea"),
      v.literal("active"),
      v.literal("paused"),
      v.literal("archived")
    ),
    tags: v.array(v.string()),

    // Metadata
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_name", ["nameId"])
    .index("by_created", ["createdAt"])
    .index("by_updated", ["updatedAt"]),
});
```

### TypeScript Types

```typescript
// types.ts
export type NameStatus = "available" | "assigned" | "considering";
export type ProjectStatus = "idea" | "active" | "paused" | "archived";

export type Name = {
  _id: Id<"names">;
  name: string;
  status: NameStatus;
  assignedTo?: Id<"projects">;
  notes?: string;
};

export type Project = {
  _id: Id<"projects">;
  nameId?: Id<"names">;
  consideringNameIds: Id<"names">[];
  description?: string;
  githubRepo?: string;
  productionUrl?: string;
  status: ProjectStatus;
  tags: string[];
  createdAt: number;
  updatedAt: number;
};
```

---

## User Interface

### Pages & Routes

```
/                           - Dashboard (project table)
/projects/new               - Add new project
/projects/[id]              - Edit project
/names                      - Name pool browser (future)
```

### Dashboard (Main Page)

**Components:**
- `ProjectTable` - Main data table (TanStack Table + shadcn)
  - Columns: name, description, status, tags, GitHub, production URL
  - Row actions: edit, delete
  - Bulk actions: delete multiple, change status
- `StatusFilter` - Tabs or dropdown (All, Ideas, Active, Paused, Archived)
- `SearchBar` - Full-text search across name + description
- `StatsOverview` - Counts per status
- `AddProjectButton` - Opens add form

**Features:**
- Click row → edit page
- Search updates instantly
- Filter by status
- Sort any column
- Mobile responsive

### Project Form (Add/Edit)

**Fields:**
- **Status** (required): Radio buttons or select
- **Name:**
  - If idea: Multi-select from available names
  - If active/paused/archived: Single select from available names
- **Description** (optional): Textarea
- **GitHub Repo** (optional): Input with format hint "owner/repo"
- **Production URL** (optional): Input with URL validation
- **Tags** (optional): Tag input (comma-separated or multi-select)

**Validation:**
- Active/paused/archived MUST have a name selected
- GitHub repo format: `^[a-zA-Z0-9_-]+/[a-zA-Z0-9_-]+$`
- Production URL format: valid URL

**Behavior:**
- Save → update name statuses atomically
- If changing idea → active: prompt to pick one name
- If deleting project with assigned name: prompt to release name

### Delete Confirmation

- Dialog/modal with project name
- Warning if name is assigned
- Option to release name back to pool
- Bulk delete: show count + confirm

---

## Implementation Plan

### Week 1: Foundation → MVP

#### Day 1-2: Backend (Convex)
**Goal:** Database + CRUD working

- [x] Initialize Next.js 16 project (`create-next-app`)
- [ ] Set up Convex (`npm install convex`, `npx convex dev`)
- [ ] Define schema (`convex/schema.ts`)
- [ ] Implement mutations:
  - `createProject`
  - `updateProject`
  - `deleteProject`
  - `createName`
  - `updateName`
  - `linkNameToProject`
  - `releaseNameFromProject`
- [ ] Implement queries:
  - `listProjects` (with filters)
  - `getProject`
  - `listNames` (with filters)
  - `getAvailableNames`
- [ ] Test via Convex dashboard
- [ ] Deploy to Vercel (continuous deployment)

#### Day 3-4: Frontend (Next.js + shadcn)
**Goal:** UI fully functional

- [ ] Install shadcn components:
  - `npx shadcn@latest add table button input textarea select dialog badge`
- [ ] Build `ProjectTable` component
  - TanStack Table setup
  - Column definitions
  - Filtering, sorting, search
  - Row actions (edit, delete)
- [ ] Build `ProjectForm` component
  - Form with react-hook-form + zod validation
  - Status-dependent name selection logic
  - Save/cancel handlers
- [ ] Build dashboard page (`app/page.tsx`)
  - Status filter
  - Search bar
  - Stats overview
  - Add button
- [ ] Build add/edit pages
  - `/projects/new`
  - `/projects/[id]`
- [ ] Build delete confirmation dialog
- [ ] Connect to Convex queries/mutations
- [ ] Loading states, error handling

#### Day 5: Import & Data Migration
**Goal:** Real data loaded

- [ ] Write import script:
  - Parse `~/Development/codex/docs/projects.md`
  - Parse `~/Development/codex/docs/project-names.md`
  - Create names in Convex
  - Create projects in Convex
  - Link names to projects based on status
- [ ] Run import via Convex action or API route
- [ ] Verify all 57 projects imported correctly
- [ ] Verify all names imported correctly
- [ ] Fix any data issues

#### Day 6-7: Polish & Ship
**Goal:** Production-ready

- [ ] Mobile responsive testing
- [ ] Dark mode (shadcn default)
- [ ] Loading skeletons
- [ ] Error boundaries
- [ ] Empty states ("No projects yet")
- [ ] Form validation messages
- [ ] URL state (filters, search persist in URL)
- [ ] README documentation
- [ ] Final deploy to Vercel
- [ ] Test in production
- [ ] Dogfood: use it daily

---

## Success Criteria

### Functional
- ✅ View all 57 projects in clean table
- ✅ Filter by status works instantly
- ✅ Search finds projects by name/description
- ✅ Add new project in <10 seconds
- ✅ Edit project inline
- ✅ Delete with confirmation
- ✅ Name pool properly managed (no orphaned names)
- ✅ Ideas can consider multiple names
- ✅ Active projects locked to one name

### Non-Functional
- ✅ Dashboard loads <500ms
- ✅ Mobile usable (responsive)
- ✅ Dark mode works
- ✅ No data loss (all 57 projects imported correctly)
- ✅ Deployed & accessible from anywhere
- ✅ Faster than opening markdown files

### Quality
- ✅ No TypeScript errors
- ✅ No console errors
- ✅ Forms validate correctly
- ✅ Name-project relationships enforced
- ✅ Atomic updates (no partial state)

---

## Migration Strategy

### From Markdown Files

**Source Files:**
- `~/Development/codex/docs/projects.md` (57 projects)
- `~/Development/codex/docs/project-names.md` (name pool)

**Import Process:**

1. **Parse names:**
   - Extract assigned names from projects.md
   - Extract available names from project-names.md
   - Create `names` table entries with correct status

2. **Parse projects:**
   - Extract name, description, GitHub, status, tags
   - Create `projects` table entries
   - Link to names based on status:
     - Active/paused/archived: set `nameId`
     - Ideas: set `consideringNameIds` (if multiple names listed)

3. **Validate:**
   - All projects have valid name links
   - All assigned names point to correct projects
   - No duplicate names
   - No orphaned references

4. **Keep parallel:**
   - Don't delete markdown files for 1 month
   - Manual comparison to ensure correctness

---

## Future Iterations (Post-MVP)

### Phase 2: GitHub Sync
- Auto-detect project status from GitHub activity
- Sync project descriptions from README
- Show commit stats, stars, last update
- Batch sync with rate limit handling
- Cron job for daily sync

### Phase 3: AI Features (GPT-5)
- Auto-generate descriptions from GitHub README
- Suggest tags based on repo topics/language
- "What should I work on?" recommendations
- Detect stale projects worth archiving
- Name suggestion based on project description

### Phase 4: Enhanced UX
- Project detail page (notes, changelog, links)
- Name pool browser (/names page)
- Bulk operations (status changes, tagging)
- Export to markdown
- URL state for filters/search

### Phase 5: Advanced Features
- CLI access (`powder list`, `powder add`)
- Analytics (velocity, project distribution)
- Templates (scaffold new projects)
- Public project page (share your portfolio)

---

## Technical Decisions

### Why Convex?
- Built-in real-time (for future features)
- Simple mutations/queries (no REST API boilerplate)
- Serverless (no infrastructure management)
- TypeScript end-to-end
- Scheduled functions (cron) for future GitHub sync

### Why Next.js 16?
- Server Components (fast initial load)
- Server Actions (simple mutations)
- Turbopack (instant builds)
- Vercel deployment (one command)
- React 19.2 features

### Why shadcn/ui?
- Copy-paste components (no package bloat)
- TanStack Table integration
- Beautiful defaults
- Dark mode built-in
- Tailwind-based (easy customization)

### Design Principles
- **Simplicity:** Manual everything (MVP)
- **Speed:** Ship in 1-2 weeks
- **Explicitness:** Clear name-project relationships
- **Modularity:** Each table has clear responsibility
- **Pragmatism:** No premature optimization

---

## Open Questions

### Resolved ✅
- ✅ GitHub field format → "owner/repo" string
- ✅ Name-project relationship → Two tables, status-dependent links
- ✅ Tag structure → Free-form array for now

### To Decide
- Should we add a `priority` field to projects?
- Do we want project notes (longer-form than description)?
- Should archived projects automatically release names?
- Date range filter for createdAt/updatedAt?

---

## Next Steps

1. Review this spec
2. Approve schema design
3. Run `/plan` to break into concrete implementation tasks
4. Start Day 1: Initialize project + Convex setup

---

**Let's build this.** 🚀
