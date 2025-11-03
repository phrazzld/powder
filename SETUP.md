# Setup Instructions

## Prerequisites

- Node.js 22+ (managed via asdf)
- pnpm 10+

## Initial Setup

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Setup Convex backend:**
   ```bash
   pnpm convex:dev
   ```

   This will:
   - Prompt you to create a Convex account (or login)
   - Create a new Convex project
   - Generate a deployment URL
   - Start the Convex dev server

3. **Configure environment:**

   After running `pnpm convex:dev`, copy the `NEXT_PUBLIC_CONVEX_URL` value from the console output.

   Create `.env.local` file:
   ```bash
   cp .env.local.example .env.local
   ```

   Then add your Convex URL:
   ```
   NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
   ```

4. **Start the development server:**
   ```bash
   pnpm dev
   ```

## Development Workflow

- **Next.js dev server:** `pnpm dev` (runs on http://localhost:3000)
- **Convex dev server:** `pnpm convex:dev` (watches for backend changes)
- **Type checking:** `pnpm tsc --noEmit`
- **Deploy Convex:** `pnpm convex:deploy`

## Troubleshooting

- If Convex connection fails, verify `NEXT_PUBLIC_CONVEX_URL` is set in `.env.local`
- Ensure both dev servers (Next.js and Convex) are running during development
- For Convex auth issues, run `npx convex login` to re-authenticate
