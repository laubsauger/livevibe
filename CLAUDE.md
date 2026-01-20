# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LiveVibe is a browser-based Strudel live coding IDE with sequencer timing, LLM/MCP integration, and snippet management. The complete architecture specification lives in `docs/baseline.md` — use it as the authoritative source.

## Build, Test, and Development Commands

Commands will be established as the monorepo is bootstrapped. Expected pattern:

```bash
pnpm install          # Install dependencies
pnpm dev              # Start dev server (companion + web)
pnpm build            # Build for production
pnpm test             # Run unit tests (Vitest)
pnpm test:e2e         # Run e2e tests (Playwright)
pnpm lint             # Lint code (ESLint)
pnpm type-check       # TypeScript check
```

## Architecture

### Monorepo Structure (pnpm)

- `/apps/web` - Next.js App Router frontend (Monaco editor, sequencer UI, assistant panel)
- `/apps/companion` - Local Node runtime for Strudel execution, WebSocket/HTTP servers, MCP server
- `/packages/engine` - Framework-independent TypeScript module for transport clock, scheduler, actions
- `/packages/schemas` - Zod schemas for Plan, Action, Chunk, Snippet, LLMCallLog
- `/packages/storage` - Dexie (IndexedDB) for local-first persistence
- `/packages/llm` - Provider wrappers with cost tracking (all LLM calls must go through this)
- `/packages/observability` - LLM call tracking, cost estimation, session budgeting
- `/packages/mcp-server` - Tools exposed to external agents

### Key Architectural Decisions

1. **Companion runtime (Path B)**: Audio/timing lives in the Node companion process, not browser. IDE connects via WebSocket.
2. **Embedded player**: Companion serves `/player` endpoint, IDE embeds it in an iframe.
3. **Plan-before-execute**: LLM cannot execute immediately. Must propose structured plan → user approves → engine executes.
4. **Observable LLM calls**: Every LLM call goes through `/packages/llm` client for token/cost tracking.

### Communication Flow

```
IDE (Next.js) <--WebSocket--> Companion (Node)
                                  ├── Strudel runtime
                                  ├── Scheduler/clock
                                  └── MCP server
```

## Implementation Milestones

0. Companion boot + embedded player skeleton
1. Observability foundation (LLM tracking)
2. Editor + manual run via companion
3. Sequencer scheduling in companion
4. Assistant plan-then-execute with auditing
5. MCP server integration
6. Real Strudel runtime integration

## Coding Standards

- TypeScript strict mode
- Zod for all schema validation
- Vitest for package tests, Playwright for e2e
- Prettier + ESLint
- Commit messages: scoped and imperative (e.g., `engine: add scheduler queue`)

## Safety Constraints

- Max 200 actions per plan
- Max 50k chars per chunk
- Rate limit evaluate calls
- All assistant tool calls logged and renderable
- Plans require explicit user approval before execution
