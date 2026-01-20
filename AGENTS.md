# Repository Guidelines

## Project Structure & Module Organization
This repository currently contains a single documentation artifact. Core product and architecture guidance live in `docs/baseline.md`. There is no application code or monorepo layout checked in yet; use the baseline as the source of truth for planned packages (e.g., `/apps/web`, `/packages/engine`) until implementation begins.

## Build, Test, and Development Commands
No build, test, or dev scripts are defined in this repo at present. When bootstrapping the project, document commands in this section (e.g., `pnpm dev`, `pnpm test`, `pnpm lint`) and keep them consistent with the baseline’s monorepo plan.

## Coding Style & Naming Conventions
No style guide or tooling is configured yet. If you add tooling, prefer:
- TypeScript-first formatting with a standard formatter (e.g., Prettier) and a strict linter.
- Consistent naming for packages and modules (e.g., `packages/engine`, `packages/schemas`).
- Clear file naming for domain concepts (e.g., `scheduler.ts`, `runtimeAdapter.ts`).

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
