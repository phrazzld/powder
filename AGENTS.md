# Repository Guidelines

## Project Structure & Module Organization
- `src/app` contains the Next.js App Router entry (`layout.tsx`, route pages, global styles).
- `src/components` holds feature components; shared primitives live in `src/components/ui`.
- `src/lib` provides cross-cutting helpers (Convex client, validation, utilities).
- `convex` defines server functions, schema, and generated client typings—keep API mutations colocated here.
- Assets and Tailwind configuration stay in root-level config files (`tailwind.config.ts`, `postcss.config.js`).

## Build, Test, and Development Commands
- `pnpm dev` launches the Next.js dev server; run alongside `pnpm convex:dev` for live Convex functions.
- `pnpm build` produces the production bundle and validates TypeScript.
- `pnpm start` serves the built app locally; use after `pnpm build`.
- `pnpm lint` runs Next.js + ESLint with the project presets.
- `pnpm convex:deploy` deploys Convex functions; ensure schema changes are committed first.

## Coding Style & Naming Conventions
- Use TypeScript with strict mode; prefer typed props and return values.
- Follow 2-space indentation, kebab-case filenames for components, and named exports where practical.
- Compose UI with Tailwind utility classes; keep shared styles in `globals.css`.
- Import local modules through the `@/` alias mapped to `src/`.
- Run `pnpm lint` before pushing to enforce ESLint and Next best practices.

## Testing Guidelines
- Automated tests are not yet implemented; introduce unit or component tests alongside new features.
- Add `*.test.ts[x]` files near the code under `src/` and wire them into the `test` script.
- Replace the placeholder `pnpm test` command with your chosen runner (e.g., Vitest, Playwright) when tests land.
- Validate Convex mutations with mock data or the Convex dashboard before merging.

## Commit & Pull Request Guidelines
- Follow Conventional Commits (`feat:`, `fix:`, `chore:`) as used in the existing history.
- Scope commits narrowly; include schema migrations and Convex changes in the same message.
- In PRs, describe user-facing behaviour, link relevant issues or TODOs, and attach UI screenshots for visual tweaks.
- Confirm linting/build steps pass locally and mention any gaps (e.g., pending tests) in the PR description.
