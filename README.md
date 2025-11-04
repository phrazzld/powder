# Powder

A modern project name manager built with Next.js and Convex. Manage creative project names, track project metadata, and maintain a pool of available names for future ideas.

## Features

- Track project names with state management (available, considering, assigned)
- Organize projects by status (idea, active, paused, archived)
- Real-time updates via Convex subscriptions
- GitHub repo and production URL tracking
- Filter, search, and sort with instant updates
- Mobile-responsive interface

## Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript
- **Backend**: Convex (serverless database + realtime API)
- **UI**: shadcn/ui (Radix), Tailwind CSS 4
- **Forms**: React Hook Form + Zod validation
- **Tables**: TanStack React Table
- **Package Manager**: pnpm 10.17.1

## Prerequisites

- Node.js 18+ (tested with v22.15)
- pnpm 10+ (or npm/yarn)
- Convex account (free tier available at [convex.dev](https://convex.dev))

## Getting Started

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd powder
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Set up Convex

```bash
# Start Convex dev environment (creates .env.local automatically)
pnpm convex:dev
```

This will:
- Prompt you to log in to Convex (or create an account)
- Create a new Convex project
- Generate `.env.local` with `NEXT_PUBLIC_CONVEX_URL`
- Deploy your schema and functions

### 4. Start the development server

In a separate terminal:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## Development Commands

```bash
# Frontend
pnpm dev          # Start Next.js dev server (port 3000)
pnpm build        # Production build
pnpm start        # Start production server
pnpm lint         # Run ESLint

# Backend (Convex)
pnpm convex:dev   # Start Convex in dev mode (run in separate terminal)
pnpm convex:deploy # Deploy to Convex production
```

## Project Structure

```
powder/
├── src/
│   ├── app/              # Next.js App Router pages
│   │   ├── page.tsx      # Dashboard (Server Component)
│   │   └── projects/     # Project CRUD pages
│   ├── components/
│   │   ├── ui/          # shadcn/ui components
│   │   ├── project-form.tsx
│   │   ├── project-table.tsx
│   │   └── ...          # Other feature components
│   └── lib/
│       ├── convex.ts    # ConvexReactClient singleton
│       ├── validation.ts # Zod schemas
│       └── utils.ts     # Utilities (cn, etc.)
│
└── convex/              # Backend (Convex)
    ├── schema.ts        # Database schema
    ├── names.ts         # NameManager module
    ├── projects.ts      # ProjectManager module
    └── projectNameLinker.ts  # Cross-table linking
```

## Architecture

Three-module backend (NameManager, ProjectManager, ProjectNameLinker) with atomic cross-table operations. See [CLAUDE.md](./CLAUDE.md) for detailed architecture and database schema.

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Connect repository to Vercel
3. Set environment variable:
   - `NEXT_PUBLIC_CONVEX_URL` (from Convex production deployment)
4. Deploy

### Convex Production

```bash
pnpm convex:deploy
```

Copy the production URL to Vercel environment variables.

## Contributing

This is a personal project, but suggestions and improvements are welcome! See [CLAUDE.md](./CLAUDE.md) for coding conventions and architecture decisions.

## License

ISC
