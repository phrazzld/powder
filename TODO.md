# TODO: Powder MVP Implementation

## Context

**Architecture**: Modular monolith with Convex backend + Next.js 16 frontend (see DESIGN.md)
**Key Modules**: NameManager, ProjectManager, ProjectNameLinker (Convex) + Dashboard, ProjectForm (Next.js)
**Patterns**: Direct Convex hooks (useQuery, useMutation), shadcn/ui components, Server Components for data fetching
**Timeline**: 1-2 weeks to ship MVP

---

## Phase 1: Foundation (Days 1-2)

### Infrastructure Setup

- [x] **Initialize Next.js 16 project with dependencies**
  ```
  Files: package.json, next.config.js, tsconfig.json, tailwind.config.ts
  Commands:
    - npx create-next-app@latest powder --typescript --tailwind --app
    - npm install convex react-hook-form @hookform/resolvers zod @tanstack/react-table lucide-react
    - npm install -D @types/node
  Architecture: Foundation for Next.js + Convex integration
  Success: npm run dev works, TypeScript compiles, Tailwind configured
  Test: Manual verification (dev server runs)
  Time: 30min
  ```

- [x] **Setup Convex backend**
  ```
  Files: convex.json, .env.local
  Commands:
    - npx convex dev
    - Copy NEXT_PUBLIC_CONVEX_URL to .env.local
  Architecture: Establishes Convex backend connection
  Success: Convex dashboard accessible, deployment ID generated
  Test: Convex dev dashboard shows connected
  Time: 15min
  ```

- [x] **Install shadcn/ui components**
  ```
  Files: components/ui/* (auto-generated)
  Commands:
    - npx shadcn@latest init
    - npx shadcn@latest add table button form input textarea select dialog badge dropdown-menu
  Architecture: UI component foundation
  Success: All shadcn components installed, no TypeScript errors
  Test: Import a component, verify no errors
  Time: 30min
  ```

### Backend: Convex Schema & Database

- [~] **Implement Convex schema (names + projects tables)**
  ```
  Files: convex/schema.ts
  Architecture: Database schema from DESIGN.md "Integration Points"
  Pseudocode: See DESIGN.md section "Convex Database Schema"
  Success:
    - names table: name, status, assignedTo, notes fields
    - projects table: nameId, consideringNameIds, description, githubRepo, productionUrl, status, tags, timestamps
    - Indexes: by_name, by_status, by_project, by_created, by_updated
    - Schema validates in Convex dashboard
  Test: Run `npx convex dev`, verify schema appears in dashboard
  Dependencies: None
  Time: 30min
  ```

### Backend: NameManager Module

- [ ] **Implement NameManager queries**
  ```
  Files: convex/names.ts
  Architecture: Implements Module 1 (NameManager) from DESIGN.md
  Pseudocode: See DESIGN.md "Module 1: NameManager" query interfaces
  Success:
    - listNames(status?: NameStatus): Name[]
    - getAvailableNames(): Name[]
    - getName(nameId): Name | null
    - All queries use correct indexes
    - Return types match TypeScript interfaces
  Test: Call from Convex dashboard, verify results
  Dependencies: schema.ts
  Time: 45min
  ```

- [ ] **Implement NameManager mutations**
  ```
  Files: convex/names.ts
  Architecture: Implements Module 1 (NameManager) from DESIGN.md
  Pseudocode: See DESIGN.md "Module 1: NameManager" mutation interfaces + state machine
  Success:
    - createName(name, notes?): Id<"names">
    - updateNameNotes(nameId, notes): void
    - _transitionNameState(nameId, toStatus, assignedTo?): void (internal)
    - Validates name uniqueness (throw ConvexError if duplicate)
    - State transitions follow state machine diagram
  Test:
    - Create name → verify status "available"
    - Duplicate name → verify throws error
    - Transition state → verify updates correctly
  Dependencies: schema.ts
  Time: 1hr
  ```

### Backend: ProjectManager Module

- [ ] **Implement ProjectManager queries**
  ```
  Files: convex/projects.ts
  Architecture: Implements Module 2 (ProjectManager) from DESIGN.md
  Pseudocode: See DESIGN.md "Module 2: ProjectManager" + "Search and Filter Algorithm"
  Success:
    - listProjects(status?, search?, sortBy?, sortOrder?): ProjectWithName[]
    - getProject(projectId): ProjectWithName | null
    - getProjectStats(): ProjectStats
    - Enriches projects with name data (joins nameId → name string)
    - Filters by status, searches name+description, sorts correctly
  Test:
    - List all projects → verify enrichment
    - Filter by status → verify only matching status returned
    - Search → verify finds projects by name/description
    - Sort by updated → verify order correct
  Dependencies: schema.ts, names.ts (for name resolution)
  Time: 1.5hr
  ```

- [ ] **Implement ProjectManager mutations with validation**
  ```
  Files: convex/projects.ts
  Architecture: Implements Module 2 (ProjectManager) from DESIGN.md
  Pseudocode: See DESIGN.md "Module 2: ProjectManager" + "Business Rule Validation"
  Success:
    - createProject(...): Id<"projects">
    - updateProject(projectId, ...): void
    - deleteProject(projectId, releaseNames): void
    - Validates business rules (idea vs active name requirements)
    - Validates GitHub repo format (owner/repo regex)
    - Validates production URL format
    - Throws ConvexError with clear messages on validation failure
  Test:
    - Create idea without name → success
    - Create active without name → throws error
    - Create active with name → success
    - Invalid GitHub repo → throws error
    - Update project → verify changes applied
  Dependencies: schema.ts, projectNameLinker.ts (for linking operations)
  Time: 2hr
  ```

### Backend: ProjectNameLinker Module

- [ ] **Implement ProjectNameLinker mutations**
  ```
  Files: convex/projectNameLinker.ts
  Architecture: Implements Module 3 (ProjectNameLinker) from DESIGN.md
  Pseudocode: See DESIGN.md "Module 3: ProjectNameLinker" algorithms (linking, promotion, release)
  Success:
    - linkNamesToProject(projectId, status, nameId?, consideringNameIds): void
    - updateProjectNames(projectId, old/new names): void
    - promoteIdeaToActive(projectId, chosenNameId): void
    - releaseProjectNames(projectId, releaseToPool): void
    - handleStatusChange(projectId, oldStatus, newStatus): void
    - All operations are atomic (transaction-safe)
    - Validates name availability before assignment
    - Maintains referential integrity (names.assignedTo <-> projects.nameId)
  Test:
    - Link name to active project → name status becomes "assigned"
    - Promote idea to active → chosen name assigned, others released
    - Delete project with releaseNames=true → name becomes "available"
    - Delete project with releaseNames=false → name stays "assigned"
  Dependencies: schema.ts, names.ts
  Time: 2hr
  ```

---

## Phase 2: Frontend UI (Days 3-4)

### Next.js Setup & Layout

- [ ] **Configure root layout with ConvexProvider**
  ```
  Files: app/layout.tsx, lib/convex.ts
  Architecture: Next.js root layout from DESIGN.md "Integration Points"
  Success:
    - ConvexProvider wraps children
    - ConvexReactClient initialized with NEXT_PUBLIC_CONVEX_URL
    - Dark mode default (shadcn theme)
    - Font configuration (Geist Sans/Mono or similar)
  Test: Dev server runs, no provider errors in console
  Dependencies: Convex setup
  Time: 30min
  ```

- [ ] **Create global styles and utilities**
  ```
  Files: app/globals.css, lib/utils.ts
  Architecture: Tailwind + shadcn utilities from DESIGN.md
  Success:
    - Tailwind directives configured
    - cn() utility for class merging (clsx + tailwind-merge)
    - Base styles applied (shadcn defaults)
  Test: Styles load, cn() works correctly
  Dependencies: shadcn setup
  Time: 15min
  ```

### Validation & Types

- [ ] **Implement form validation schemas**
  ```
  Files: lib/validation.ts
  Architecture: Zod schemas from DESIGN.md "Module 5: ProjectForm"
  Success:
    - projectFormSchema with all fields (status, nameId, consideringNameIds, etc.)
    - Business rule refinement (active/paused/archived requires nameId)
    - GitHub repo regex validation
    - Production URL validation
    - Export ProjectFormValues type
  Test:
    - Valid form data → schema.parse() succeeds
    - Invalid data → schema.parse() throws with clear errors
  Dependencies: None
  Time: 30min
  ```

### Dashboard Components

- [ ] **Implement StatusFilter component**
  ```
  Files: components/status-filter.tsx
  Architecture: Client Component for status tabs from DESIGN.md "Module 4"
  Success:
    - Tabs for All, Ideas, Active, Paused, Archived
    - Updates URL param on change (useRouter + searchParams)
    - Highlights active tab
    - Mobile responsive
  Test: Click tab → URL updates → dashboard re-renders
  Dependencies: None
  Time: 30min
  ```

- [ ] **Implement SearchBar component**
  ```
  Files: components/search-bar.tsx
  Architecture: Client Component with debounce from DESIGN.md "Module 4"
  Success:
    - Input with magnifying glass icon
    - Debounces input (300ms)
    - Updates URL param on change
    - Clears button (X icon)
    - Placeholder text
  Test: Type → wait 300ms → URL updates → dashboard re-renders
  Dependencies: None
  Time: 30min
  ```

- [ ] **Implement StatsOverview component**
  ```
  Files: components/stats-overview.tsx
  Architecture: Client Component from DESIGN.md "Module 4"
  Success:
    - Displays total + counts per status
    - Uses usePreloadedQuery for stats
    - Card layout with badges (ideas=blue, active=green, paused=yellow, archived=gray)
    - Shows loading state
  Test: Render with preloaded data → displays correct counts
  Dependencies: Convex queries (getProjectStats)
  Time: 45min
  ```

- [ ] **Implement ProjectTable component with TanStack Table**
  ```
  Files: components/project-table.tsx
  Architecture: Client Component from DESIGN.md "Module 4"
  Pseudocode: See DESIGN.md table implementation patterns
  Success:
    - Columns: name, description, status, tags, GitHub, production URL, actions
    - Uses usePreloadedQuery for data
    - TanStack Table with sorting, filtering (client-side)
    - Row actions: edit (navigate to /projects/[id]), delete (open dialog)
    - Status badges with colors
    - Tags displayed as chips
    - Click row → navigate to edit page
    - Empty state ("No projects yet")
    - Loading skeleton
  Test:
    - Renders projects from preloaded data
    - Sort by column → order changes
    - Click edit → navigates correctly
    - Click delete → dialog opens
  Dependencies: Convex queries (listProjects)
  Time: 2.5hr
  ```

- [ ] **Implement DeleteDialog component**
  ```
  Files: components/delete-dialog.tsx
  Architecture: Client Component from DESIGN.md "Module 4"
  Success:
    - Dialog with project name
    - Checkbox for "Release name back to pool" (if project has assigned name)
    - Confirm/Cancel buttons
    - Calls deleteProject mutation
    - Shows loading state during deletion
    - Closes on success
    - Shows error toast on failure
  Test:
    - Open dialog → displays project name
    - Confirm → mutation called → project deleted → dialog closes
    - Cancel → dialog closes without deleting
  Dependencies: Convex mutations (deleteProject)
  Time: 1hr
  ```

### Dashboard Page

- [ ] **Implement Dashboard page (Server Component)**
  ```
  Files: app/page.tsx
  Architecture: Implements Module 4 (Dashboard) from DESIGN.md
  Pseudocode: See DESIGN.md "Module 4: Dashboard" server-side data fetching
  Success:
    - Server Component with preloadQuery
    - Reads searchParams for filters (status, search, sortBy, sortOrder)
    - Preloads listProjects and getProjectStats
    - Passes preloaded data to client components
    - "Add Project" button → /projects/new
    - Layout: header, stats, filters, table
    - Mobile responsive
  Test:
    - Visit / → dashboard renders
    - Change filter → URL updates → page re-renders with filtered data
    - Click "Add Project" → navigates to /projects/new
  Dependencies: All dashboard components, Convex queries
  Time: 1hr
  ```

### Project Form Components

- [ ] **Implement ProjectForm component**
  ```
  Files: components/project-form.tsx
  Architecture: Implements Module 5 (ProjectForm) from DESIGN.md
  Pseudocode: See DESIGN.md "Module 5: ProjectForm" implementation
  Success:
    - React Hook Form with Zod resolver
    - Status field (select: idea, active, paused, archived)
    - Name field (conditional on status):
      - Idea: multi-select for consideringNameIds (optional)
      - Active/paused/archived: single select for nameId (required)
    - Description field (textarea, optional)
    - GitHub repo field (input, optional, format hint)
    - Production URL field (input, optional, URL validation)
    - Tags field (comma-separated input or multi-select, optional)
    - Save/Cancel buttons
    - Inline validation errors
    - Loading state during submission
    - Success: calls onSuccess callback
    - Error: shows toast notification
  Test:
    - Fill form → submit → mutation called → data validated
    - Change status idea→active → name field changes to required single-select
    - Invalid GitHub repo → inline error shown
    - Successful submit → onSuccess called
  Dependencies: Convex mutations (createProject, updateProject), queries (getAvailableNames)
  Time: 3hr
  ```

### Project Pages

- [ ] **Implement Add Project page**
  ```
  Files: app/projects/new/page.tsx
  Architecture: Client Component page from DESIGN.md "File Organization"
  Success:
    - Renders ProjectForm with no projectId (create mode)
    - onSuccess → navigate to / (dashboard)
    - onCancel → navigate back to /
    - Page title "Add Project"
    - Centered form layout
  Test: Visit /projects/new → form renders → submit → redirects to dashboard
  Dependencies: ProjectForm component
  Time: 30min
  ```

- [ ] **Implement Edit Project page**
  ```
  Files: app/projects/[id]/page.tsx
  Architecture: Client Component page from DESIGN.md "File Organization"
  Success:
    - Reads projectId from params
    - Fetches project data (useQuery)
    - Renders ProjectForm with projectId (edit mode)
    - Pre-populates form with existing data
    - onSuccess → navigate to /
    - onCancel → navigate back to /
    - Loading state while fetching
    - Not found → 404 page
    - Page title "Edit Project"
  Test: Visit /projects/[id] → form pre-populated → submit → redirects to dashboard
  Dependencies: ProjectForm component, Convex queries (getProject)
  Time: 45min
  ```

---

## Phase 3: Data Migration & Polish (Days 5-7)

### Import Script

- [ ] **Implement markdown import action**
  ```
  Files: convex/import.ts, scripts/import-data.ts (optional CLI wrapper)
  Architecture: Convex action from DESIGN.md "Migration Strategy"
  Pseudocode: Parse markdown → create names → create projects → link names
  Success:
    - Parses ~/Development/codex/docs/projects.md (table format)
    - Parses ~/Development/codex/docs/project-names.md (assigned + available)
    - Creates names with correct status (assigned vs available)
    - Creates projects with correct fields
    - Links names to projects (active/paused → nameId, ideas → consideringNameIds)
    - Validates all data before insertion
    - Idempotent (can run multiple times without duplicates)
    - Logs progress (X names created, Y projects created)
  Test:
    - Run import → verify 57 projects + ~100 names in database
    - Check name statuses match expected
    - Check project-name relationships correct
    - Re-run import → no duplicates created
  Dependencies: All Convex modules
  Time: 3hr
  ```

### Error Handling & UX Polish

- [ ] **Implement toast notifications**
  ```
  Files: components/ui/toast.tsx, lib/toast.ts (or use sonner library)
  Architecture: Error handling from DESIGN.md "Error Handling Strategy"
  Success:
    - Toast provider in root layout
    - Success/error/info variants
    - Auto-dismiss after 5s
    - Close button
    - Used in forms, mutations, delete operations
  Test: Trigger error → toast appears → auto-dismisses
  Dependencies: None
  Time: 30min
  ```

- [ ] **Add loading states and skeletons**
  ```
  Files: components/loading-skeleton.tsx, update all async components
  Architecture: Loading states from DESIGN.md "Module 4 & 5"
  Success:
    - Dashboard shows skeleton while loading
    - Table shows skeleton rows
    - Form shows disabled state during submission
    - Button shows spinner during mutation
    - No layout shift when loading → data
  Test: Slow network → loading states appear → data loads → loading disappears
  Dependencies: All UI components
  Time: 1.5hr
  ```

- [ ] **Add empty states**
  ```
  Files: Update project-table.tsx, dashboard components
  Architecture: Empty states from DESIGN.md "Module 4"
  Success:
    - "No projects yet" message with "Add Project" CTA
    - "No projects match your filters" for filtered empty state
    - Icon + message + action button
    - Centered layout
  Test: Empty database → empty state shown → click CTA → opens add form
  Dependencies: ProjectTable component
  Time: 30min
  ```

### Mobile Responsiveness

- [ ] **Ensure mobile responsiveness**
  ```
  Files: All component files (add responsive classes)
  Architecture: Responsive design from DESIGN.md "Dashboard"
  Success:
    - Dashboard table scrolls horizontally on mobile
    - Filters stack vertically on mobile
    - Form fields full-width on mobile
    - Dialog/modal works on mobile
    - Touch-friendly button sizes
    - No horizontal overflow
  Test: Chrome DevTools mobile view → all pages usable
  Dependencies: All UI components
  Time: 2hr
  ```

### Testing & Validation

- [ ] **Write unit tests for NameManager**
  ```
  Files: convex/names.test.ts
  Architecture: Unit tests from DESIGN.md "Testing Strategy"
  Success:
    - Test createName creates available name
    - Test createName rejects duplicate
    - Test state transitions (available → considering → assigned)
    - Test invalid transitions throw errors
    - Uses convexTest utility
  Test: npm test → all tests pass
  Dependencies: NameManager module
  Time: 1hr
  ```

- [ ] **Write integration tests for Project-Name linking**
  ```
  Files: convex/integration.test.ts
  Architecture: Integration tests from DESIGN.md "Testing Strategy"
  Success:
    - Test creating active project assigns name
    - Test promoting idea to active releases unconsidered names
    - Test deleting project releases names
    - Test name conflict detection
    - Uses convexTest utility with test database
  Test: npm test → all tests pass
  Dependencies: All Convex modules
  Time: 1.5hr
  ```

### Documentation & Deploy

- [ ] **Write README with setup instructions**
  ```
  Files: README.md
  Architecture: N/A (documentation)
  Success:
    - Project description
    - Tech stack
    - Setup instructions (npm install, convex dev, env vars)
    - Development commands (npm run dev, npm test)
    - Architecture overview (link to DESIGN.md)
    - Deployment instructions (Vercel)
  Test: Follow README from scratch → project runs
  Dependencies: None
  Time: 30min
  ```

- [ ] **Deploy to Vercel**
  ```
  Files: vercel.json (if needed), .env.production
  Architecture: Deployment from DESIGN.md "Hosting"
  Success:
    - Connect GitHub repo to Vercel
    - Set NEXT_PUBLIC_CONVEX_URL env var in Vercel
    - Deploy to production
    - Custom domain (optional)
    - Convex production deployment
    - Verify app works in production
  Test: Visit production URL → app works
  Dependencies: All code complete
  Time: 30min
  ```

---

## Backlog (Post-MVP)

*Not in TODO.md - moved to BACKLOG.md after implementation:*

- GitHub API sync automation
- AI-powered descriptions (GPT-5)
- Name suggestion feature
- Project detail pages (notes, changelog)
- Export to markdown
- CLI access
- Multi-user support with auth
- Advanced analytics
- E2E tests with Playwright

---

## Design Iteration Points

**After Phase 1 (Backend Complete)**:
- Review module boundaries: Are NameManager/ProjectManager/ProjectNameLinker at right abstraction level?
- Evaluate Convex query performance: Are joins expensive? Need denormalization?
- Check error handling patterns: Are ConvexErrors clear and actionable?

**After Phase 2 (Frontend Complete)**:
- Review component boundaries: Is ProjectForm too complex? Extract sub-components?
- Evaluate form UX: Is status-dependent field switching intuitive?
- Check loading states: Are they fast enough? Need optimistic updates?

**After Phase 3 (Polish Complete)**:
- Review test coverage: Missing critical paths?
- Evaluate mobile UX: Touch targets large enough? Navigation intuitive?
- Performance check: Dashboard load time < 500ms? Form submission < 200ms?

---

## Automation Opportunities

- Script for creating new Convex module (boilerplate for queries/mutations)
- Script for creating new shadcn component wrapper
- Pre-commit hook for TypeScript + lint checks
- GitHub Action for running tests on PR

---

## Success Criteria

✅ **Functional**:
- All 57 projects imported and viewable
- Create/edit/delete projects works
- Filters and search work
- Name pool managed correctly
- Ideas can become active projects

✅ **Technical**:
- No TypeScript errors
- No console errors
- All tests pass
- Convex schema validated
- Deployed to Vercel

✅ **UX**:
- Dashboard loads < 500ms
- Mobile responsive
- Loading states present
- Error messages clear
- Dark mode works

---

**Timeline**: 5-7 days of focused implementation
**Approach**: Build vertically (one feature end-to-end) rather than horizontally (all backend, then all frontend)
**Philosophy**: Ship fast, iterate, dogfood your own tool

Ready to implement? Start with Phase 1, Task 1. Each task is independent and testable.
