# Repository Guidelines

## Project Structure & Module Organization
This repo is now a pnpm monorepo. Core product and architecture guidance live in `docs/baseline.md`. Current layout:
- `apps/web` — Next.js App Router UI with Tailwind + shadcn-style components.
- `apps/companion` — Node companion runtime (HTTP + WebSocket stubs, `/health` and `/player`).
- `packages/engine` — Engine package stub.
- `packages/schemas` — Schemas package stub.
- `docs/` — Roadmap and baseline docs.

## Build, Test, and Development Commands
- `pnpm dev` — Run companion + web together.
- `pnpm dev:web` — Run the Next.js app only.
- `pnpm dev:companion` — Run the companion only.
- `pnpm build` / `pnpm start` — Build and start the web app.
- `pnpm lint` — Next.js lint.

## Coding Style & Naming Conventions
TypeScript is the default across the monorepo. UI styling uses Tailwind CSS with dark-first tokens in `apps/web/app/globals.css` and config in `apps/web/tailwind.config.ts`. shadcn-style components live under `apps/web/components/ui`, with utilities in `apps/web/lib/utils.ts`. Keep file naming aligned to domain concepts (e.g., `scheduler.ts`, `runtimeAdapter.ts`).

## Testing Guidelines
No tests are present yet. When adding tests, document:
- Framework choice (e.g., Vitest for packages, Playwright for e2e).
- Naming patterns (e.g., `*.test.ts` or `*.spec.ts`).
- How to run unit and end-to-end suites.

## Commit & Pull Request Guidelines
There is no Git history to derive conventions from. Until standards are established:
- Use imperative, scoped commit messages (example: `engine: add scheduler queue`).
- PRs should include a concise description, linked issues (if any), and screenshots for UI changes.
- Note any breaking changes and migration steps.

## Architecture Notes
Refer to `docs/baseline.md` for the intended architecture: a Next.js web IDE, an engine package, optional MCP server, and schema definitions. Keep new code aligned to that plan unless the project owner approves deviations.
