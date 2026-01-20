## Handover spec: Strudel IDE webapp with sequencer timing, LLM + MCP integration, and snippet management

### 1) Product intent

Build a browser based IDE-like environment for Strudel live coding that adds:

* Autocomplete and language aware editor tooling
* A step sequencer style timeline (“tlooper”) that makes time explicit for humans and for an LLM
* LLM integration (via MCP and direct tool calls) that can write code chunks, plan timed actions, and execute them
* Visualized plans and executed actions (what the LLM intends, what happened, what is scheduled)
* Snippet and project browser to store, retrieve, and reuse patterns and sets

The app should support two workflows in parallel:

1. Traditional live coding: user types Strudel code, runs it immediately.
2. Sequenced performance: user or LLM schedules changes at musical boundaries (loop, bar, step), with previewable intent and deterministic execution.

---

### 2) Core user stories (implementation targets)

#### Editing

* As a user, I can open a project with multiple files (or “chunks”) and edit with autocomplete and inline docs.
* As a user, I can run a selection or a named chunk.
* As a user, I can see diagnostics (syntax errors, runtime errors) inline.

#### Performance and timing

* As a user, I can set tempo, time signature, steps per bar, loop length.
* As a user, I can schedule an action like “at loop 1 step 4, bring in bass with velocity 0.7”.
* As a user, I can arm changes to apply on next boundary (next step, next bar, next loop), not immediately.

#### LLM and MCP

* As a user, I can ask an assistant to “build a drop over 4 loops” and see a structured plan before it executes.
* As a user, I can approve, edit, or reject the plan.
* As a user, I can see a timeline of actions the assistant executed and the resulting Strudel code changes.

#### Snippets and assets

* As a user, I can store snippets (pattern lines, chunk blocks, templates, whole projects).
* As a user, I can search tags and quickly insert snippets into the editor.
* As a user, I can reference snippets in LLM prompts (“use my ‘acid hats’ snippet”).

---

### 3) Non goals (for v1)

* Multi user collaboration in real time (can be a later milestone).
* Full offline PWA reliability (possible later).
* Building a full DAW. Keep focus on Strudel plus sequencing and assistant.

---

### 4) Conceptual model

#### Terminology

* **Chunk**: Named Strudel code unit that can be executed, replaced, or layered (example: “drums”, “bass”, “fx”).
* **Plan**: A structured set of scheduled actions (edits, toggles, parameter changes) across musical time.
* **Action**: An atomic operation to apply at a boundary (step, bar, loop). Examples:

  * Replace chunk code
  * Set a parameter (velocity, gain, filter)
  * Mute or unmute a chunk
  * Insert snippet into a chunk
* **Transport**: Current tempo, position, and clock source.

#### Timing scheme

Represent scheduling on an explicit grid so the assistant can reason:

* loopIndex: integer, relative to “now” (0 is current loop, 1 is next loop)
* stepIndex: integer within loop (0..stepsPerLoop-1)
* boundaryType: step | bar | loop
* quantization: apply action at next boundary of given type
* deterministic: actions execute in stable order when multiple actions share same time

---

### 5) High level architecture

A pragmatic v1 approach: single webapp with a local “engine” module and an optional lightweight backend for storage.

#### Frontend (web)

* Next.js (App Router) + TypeScript
* Monaco Editor for IDE feel and autocomplete
* State management: Zustand or Redux Toolkit
* UI: Tailwind + a component kit (optional)
* Audio and Strudel runtime: run in browser if feasible, else bridge to a local runtime (see Engine)

#### Engine layer

The “Engine” is a TypeScript module responsible for:

* Transport clock and step math
* Maintaining current set of chunks
* Executing scheduled actions at boundaries
* Applying edits to chunks and sending code to Strudel runtime
* Emitting events for UI visualization

Engine should be framework independent so it can later run in:

* Browser main thread
* WebWorker (preferred if Strudel execution is heavy)
* Node (if you choose a local companion server)

#### Optional backend

* Storage: SQLite (via better-sqlite3) or Postgres
* API: simple REST or tRPC
* Auth: optional for v1 (local only), add later

A v1 can be “local-first” using IndexedDB for snippets and projects, then add server sync.

---

### 6) LLM integration design

#### Requirements

* Assistant produces a structured plan, not just text.
* Plan is visible and editable before execution.
* Assistant actions are executed through tools with audit logs.

#### Recommended pattern

* Use a tool calling interface where the assistant can:

  1. ProposePlan(plan: JSON)
  2. ApplyPlan(planId)
  3. EditChunk(chunkId, newCode)
  4. ScheduleAction(action)
  5. SearchSnippets(query)
  6. InsertSnippet(snippetId, targetChunkId, insertionMode)
  7. GetTransportState()
  8. GetProjectContext()

#### MCP

Expose the above tools through MCP so Codex or another agent can operate the app.
MCP server can live in:

* A small Node process started by the app (local dev)
* Or as an internal “tool router” if you keep everything in-process

Minimum MCP tool set for v1:

* transport.getState
* transport.setTempo
* sequencer.scheduleActions
* chunks.list
* chunks.get
* chunks.update
* snippets.search
* snippets.save
* snippets.insert
* plan.propose
* plan.approve
* plan.cancel
* logs.list

#### Plan schema (JSON)

Use a strict schema so it can be validated and rendered.

```json
{
  "id": "plan_123",
  "title": "Build energy over 4 loops",
  "createdAt": 1730000000000,
  "assumptions": {
    "bpm": 140,
    "stepsPerLoop": 16,
    "loopLengthBars": 1
  },
  "actions": [
    {
      "id": "act_1",
      "at": { "loop": 1, "step": 4, "boundary": "step" },
      "type": "chunk.update",
      "payload": { "chunkId": "bass", "code": "..." }
    },
    {
      "id": "act_2",
      "at": { "loop": 1, "step": 8, "boundary": "step" },
      "type": "param.set",
      "payload": { "target": "drums", "param": "velocity", "value": 0.7 }
    }
  ],
  "notes": "Kick enters loop 1 step 4. Hats open gradually."
}
```

Validation:

* Use zod schemas on the frontend and in the MCP server.
* Reject plans that reference unknown chunks unless they also include chunk.create actions.

---

### 7) UI layout spec

Target “Cursor-like” layout:

#### Main areas

1. Left sidebar

* Project tree (files, chunks)
* Snippets browser tab (search, tags, favorites)

2. Center editor

* Monaco editor with tabs
* Run/arm controls per chunk

3. Bottom panel

* Console logs
* Diagnostics
* Execution history

4. Right assistant panel

* Chat
* Plan viewer (structured)
* Tool activity feed (what the assistant called)
* Approve / edit / apply controls

#### Sequencer panel (top or separate tab)

* Transport controls: Play, Stop, BPM, swing (optional), quantize
* Grid view: steps horizontally, tracks vertically (chunks)
* Each cell shows scheduled actions markers
* A “Now” playhead
* An “Armed” lane for next boundary changes
* Clicking a marker opens action details and allows editing or deleting

#### Visualization of assistant activity

* “Planned” actions in one style
* “Approved” actions in another
* “Executed” actions with timestamps and result status
* “Failed” actions with error details and suggested fix

---

### 8) Data model and storage

#### Entities

* Project

  * id, name, createdAt, updatedAt
  * files: File[]
  * chunks: Chunk[]
* File

  * id, path, content
* Chunk

  * id, name, code, enabled, tags
* Snippet

  * id, title, content, language, tags, createdAt, updatedAt
* Plan

  * id, title, actions[], status: proposed | approved | applied | cancelled
* Action (scheduled)

  * id, at, type, payload, status: scheduled | executed | failed | cancelled
* ExecutionLog

  * id, time, source: user | assistant | engine
  * eventType, details

#### Storage approach

V1 local-first:

* IndexedDB (Dexie) for projects, snippets, plans, logs
  Optional export/import as JSON zip.

Later add sync:

* Backend with user accounts
* Merge strategy: last write wins for snippets, append-only for logs and plans

---

### 9) Engine internals (implementation detail)

#### Engine responsibilities

* Maintain authoritative state:

  * transportState
  * chunks state
  * scheduledActions priority queue
* Emit events:

  * transport.tick(step, bar, loop)
  * action.scheduled
  * action.executed
  * action.failed
  * chunk.updated
  * runtime.error

#### Clock

Options:

* If Strudel provides a clock or scheduling hooks, integrate directly.
* Otherwise use Web Audio clock for stable timing and compute step boundaries.

Recommended internal representation:

* ticks based on audioContext.currentTime
* convert to musical position using bpm and stepsPerBeat

#### Deterministic action ordering

If multiple actions at same boundary:

* Sort by priority then by insertion order
* Example priority: transport changes first, then chunk updates, then param changes, then UI-only

#### Pseudocode skeleton

* scheduleAction(action): validate, enqueue, emit
* onTick(now):

  * compute current musical position
  * if crossed boundary: pop and execute all actions whose “at” matches
  * emit tick events for UI

---

### 10) Strudel runtime integration

There are two plausible integration paths. Pick one early.

#### Path B: Local companion runtime

* A local Node or desktop wrapper runs Strudel and exposes WebSocket API.
* Webapp connects via ws://localhost.
* Pros: better audio reliability, more compute headroom
* Cons: more setup

For v1, implement an abstraction:

RuntimeAdapter interface:

* evaluate(code: string, context: { chunkId? }): Promise<Result>
* setParam(target: string, param: string, value: number): Promise<Result>
* mute(target: string, muted: boolean): Promise<Result>
* getStatus(): Promise<Status>

Then build one adapter first, keep other as future work.

---

### 11) Autocomplete and language tooling

Minimum viable:

* Monaco basic completion provider with snippet style completions for common Strudel constructs.
* Signature help and hover docs for common functions.
* Store Strudel API docs in a JSON manifest to power completion.

Later:

* Tree-sitter parser for Strudel dialect if available, else a lightweight parser for patterns.
* Linting rules: undefined chunk refs, invalid param ranges.

---

### 12) Repo structure (handover to Codex agent)

Monorepo with pnpm:

```
/apps/web
  /app
  /components
  /stores
  /features
    /editor
    /sequencer
    /assistant
    /snippets
  /lib
    /engineClient
    /mcpClient
  /styles
/packages/engine
  /src
    clock.ts
    scheduler.ts
    actions.ts
    state.ts
    events.ts
    runtimeAdapter.ts
/packages/schemas
  plan.ts
  action.ts
  chunk.ts
  snippet.ts
/packages/mcp-server   (optional early, but recommended)
  /src
    server.ts
    tools/*.ts
/packages/storage
  indexeddb.ts
  models.ts
```

---

### 13) Milestones (execution plan for implementation agent)

#### Milestone 1: Editor + manual run

* Monaco editor with project tree and chunk list
* Basic runtime adapter stub that logs “evaluate” calls
* Run selection, run chunk
* Local persistence for project content

Deliverable: user can edit and “run” chunks (even if runtime is stubbed initially).

#### Milestone 2: Transport + sequencer scheduling

* Transport UI (bpm, play/stop)
* Engine clock and step grid
* Schedule a manual action on a step, see marker, execute at boundary
* Execution log panel

Deliverable: deterministic scheduling and visualization.

#### Milestone 3: Snippet manager

* Snippet CRUD, tags, search
* Insert snippet into editor or chunk
* Expose snippet tools to assistant later

Deliverable: reusable pattern library.

#### Milestone 4: Assistant panel with structured plans

* Assistant chat UI
* Tool router that can accept a plan JSON and render it
* Approve/apply/cancel flow
* Actions scheduled from plan execute via engine

Deliverable: “plan then execute” assistant workflow with visualization.

#### Milestone 5: MCP server integration

* Implement MCP server exposing tools to external agent (Codex)
* Audit log of tool calls
* Permissions: read-only tools vs write tools, plus require approval for ApplyPlan

Deliverable: external agent can drive the app safely.

#### Milestone 6: Runtime adapter real integration

* Replace stub with real Strudel evaluation and control
* Validate that step boundary scheduling aligns with audio output

Deliverable: end-to-end live performance control.

---

### 14) Safety and control constraints (important for LLM)

* Assistant cannot execute immediately by default.
* Assistant must produce a plan first for any multi-step change.
* Applying a plan requires explicit user approval.
* Every tool call is logged and renderable.
* Hard limits:

  * Max actions per plan (example 200)
  * Max code size per chunk (example 50k chars)
  * Rate limit evaluate calls per second

---

### 15) “Definition of done” for v1

* User can live code with autocomplete in Monaco.
* User can define chunks and run them.
* Sequencer grid shows steps and can schedule chunk updates and param changes.
* Assistant can propose a structured plan, user can approve, plan schedules actions, engine executes them, and UI shows planned vs executed actions.
* Snippets can be saved, searched, and inserted.
* All assistant actions are visible in logs and on the sequencer.

---

### 16) Concrete task list for Codex implementation agent

1. Initialize monorepo with Next.js app and engine package.
2. Add Monaco editor with file tabs and chunk panel.
3. Implement schemas package using zod for all entities.
4. Implement storage package using Dexie with migrations.
5. Implement engine clock + scheduler with deterministic execution order.
6. Build sequencer UI grid and bind it to engine state.
7. Implement action types:

   * chunk.update
   * chunk.mute
   * param.set
   * snippet.insert
8. Build assistant panel UI with:

   * chat transcript
   * tool activity feed
   * plan viewer and editor (JSON or form based)
   * approve/apply/cancel controls
9. Implement tool router in webapp that can be called by internal LLM or MCP.
10. Implement MCP server exposing the tool router endpoints.
11. Implement runtime adapter stub then replace with Strudel integration.
12. Add end-to-end tests for:

* scheduling executes at correct boundary
* plan approval gating
* snippet insert integrity

13. Add export/import for projects and snippets.

---

### 17) Default assumptions (so the agent can start without followups)

* 16 steps per loop by default, 1 bar per loop, 4/4 time.
* “loop” means a fixed length grid, not infinite timeline.
* Quantization is always at least to step boundaries.
* Single user local-first v1 with optional MCP local server.

If you want, I can translate this into:

* A PRD plus technical design doc format
* A set of GitHub issues with acceptance criteria per milestone
* A strict JSON schema bundle and tool definitions for MCP (ready to paste into the MCP server)


## Updates for Path B (local companion runtime) + embedded Strudel UI + LLM observability from day 1

### 1) Path B architecture (stability first)

#### Components

1. **Web IDE (Next.js)**
   Editor, sequencer, assistant, snippet manager, observability UI.

2. **Local Companion Runtime (Node)**
   Runs Strudel execution engine plus scheduling bridge. Exposes:

   * WebSocket API for low latency commands and events
   * HTTP server for embedding the Strudel UI/player
   * MCP server (optional in same process) for external agents

3. **Embedded Strudel UI/player inside IDE**

   * IDE displays a “Player” panel that is an embedded view served by the companion.
   * Communication between IDE and embedded player via:

     * WebSocket shared channel, or
     * postMessage bridge if the player is in an iframe

#### Why this works

* Audio stability and timing live in the companion process.
* The IDE remains responsive and can restart independently.
* The embedded player keeps all performative controls “in one window”.

---

### 2) Companion runtime responsibilities (expanded)

#### Strudel execution host

* Owns audio clock, tempo, transport, and deterministic scheduling.
* Owns evaluation of Strudel code and runtime parameter changes.
* Emits events for:

  * transport.tick
  * chunk.started, chunk.stopped
  * action.scheduled, action.executed, action.failed
  * runtime.error

#### UI host for embedded player

* Serves a small web UI (could be:

  * Strudel’s own UI if embeddable, or
  * a minimal “Strudel Player” view you build that mirrors essential controls)
* The IDE embeds it in a docked panel (iframe).
* The player shows:

  * Play/Stop, BPM, sync status
  * Active voices or patterns
  * Output meters (optional)
  * Current loop and step position

#### Security baseline

* Companion binds to localhost only.
* IDE and player authenticate to companion via a session token stored locally.
* CORS locked down to the IDE origin.

---

### 3) Communication contract (IDE ↔ companion)

Use WebSocket for commands and event streaming.

#### Command examples

* transport.setTempo { bpm }
* transport.play {}
* transport.stop {}
* chunks.update { chunkId, code }
* params.set { target, param, value }
* scheduler.schedule { action }
* scheduler.applyPlan { planId }
* runtime.getStatus {}

#### Event examples

* transport.state { bpm, playing, loop, step, time }
* scheduler.actionExecuted { actionId, status, result, at }
* runtime.error { message, stack, chunkId? }
* chunks.updated { chunkId, revision }

This contract is also the surface you expose as MCP tools.

---

### 4) Embedded player integration options

Pick one early, implement the abstraction so you can swap later.

#### Option 1: iframe embedding (recommended)

* Companion serves the player at [http://localhost:PORT/player](http://localhost:PORT/player)
* IDE renders it in a panel via iframe
* Use postMessage for UI level interactions if needed, but prefer WebSocket for authoritative state.

Pros: simple, stable, decoupled.
Cons: styling cohesion requires some work.

#### Option 2: “Native” player panel in IDE UI

* Player is implemented as a React component in the IDE.
* It still talks to companion for audio and transport.

Pros: perfect visual integration.
Cons: more engineering, but still stable because audio is in companion.

V1 recommendation: Option 1, then optionally migrate.

---

### 5) LLM call visibility and cost observability (from day 1)

Add an “LLM Observatory” as a first class feature. Track every call whether it comes from:

* Assistant chat
* Tool router
* External MCP agent
* Internal planner

#### What to capture per call (normalized record)

* callId
* timestamp start and end
* provider (OpenAI, Anthropic, local, etc.)
* model
* request type (chat, tool, embed, etc.)
* prompt tokens
* completion tokens
* total tokens
* cached tokens if available
* cost estimate (computed)
* latency
* streaming duration
* tool calls made inside the request (names and counts)
* truncated flags (hit context limit, max tokens)
* user visible label (what this call was for)
* associated planId and actionIds (if any)

#### Cost estimation approach

* Maintain a local pricing table config:

  * input cost per 1M tokens
  * output cost per 1M tokens
  * cache read or write costs if applicable
* cost = input_tokens * input_rate + output_tokens * output_rate
* Store the pricing table version along with each call record so historical totals remain correct.

#### UI requirements

1. **Live feed panel** (right side or bottom tab)

   * Shows each call in chronological order
   * Expandable to show request metadata and tool calls
2. **Session summary**

   * Total tokens in, out, total cost estimate
   * Tokens per minute and cost per minute over last 1, 5, 15 minutes
3. **Budget controls**

   * Set a soft budget for a session
   * Warning threshold
   * Hard stop option (block assistant execution until user re-enables)
4. **Per plan and per action attribution**

   * When an LLM proposes a plan, show the cost of that proposal.
   * When it executes actions, attribute subsequent calls and tool calls to that plan.

#### Data model additions

* LLMCallLog entity
* PricingConfig entity
* SessionBudget entity (optional)
* Link fields:

  * planId
  * actionId[]
  * chunkId[]
  * snippetId[]

#### Engine and assistant integration

* Every assistant interaction uses a single “LLM Client” module that:

  * performs the API call
  * extracts usage fields
  * computes cost via pricing config
  * emits call.start and call.end events
  * writes to storage

No LLM calls should bypass this client.

---

### 6) Handover changes to repo structure

Add companion and observability packages from the start.

```
/apps/web
/apps/companion
  /src
    wsServer.ts
    httpServer.ts
    strudelHost.ts
    schedulerBridge.ts
    mcpServer.ts
    auth.ts
/packages/llm
  client.ts
  pricing.ts
  log.ts
  providers/openai.ts
  providers/anthropic.ts
/packages/observability
  models.ts
  storage.ts
  uiHooks.ts
/packages/schemas
  llmCall.ts
  pricing.ts
```

---

### 7) Milestone adjustments (to bake in stability and observability)

#### Milestone 0: Companion boot + embed player skeleton

* Companion starts on localhost, serves /health and /player
* IDE embeds /player in a panel
* WebSocket connection established, transport state round trip works

#### Milestone 1: Observability foundation

* Implement LLM client wrapper and LLMCallLog storage
* Build LLM Observatory panel showing calls, tokens, cost estimate
* Budget warning and hard stop toggles

#### Milestone 2: Editor and manual run via companion

* Editor runs chunk updates through companion, not in browser
* Player reflects current playing state

#### Milestone 3: Sequencer scheduling in companion

* Scheduling happens where the audio clock is, in companion
* IDE is primarily a visual planner and controller

#### Milestone 4: Assistant plan then execute with full auditing

* Plan proposal calls visible with cost
* Tool calls visible with linkage to plan and actions

---

### 8) Concrete task list additions for Codex agent

1. Create /apps/companion Node service with:

   * HTTP server (serves player page)
   * WebSocket server (commands and events)
   * Auth token handshake
2. Implement IDE embedded player panel:

   * iframe to companion /player
   * connection status indicator
3. Implement /packages/llm with:

   * provider wrapper
   * usage extraction
   * pricing config
   * cost computation
   * structured logging events
4. Implement LLM Observatory UI:

   * live call list
   * totals and burn rate
   * per plan attribution
   * budget controls and enforcement
5. Ensure assistant tool router is the only pathway to execute:

   * all calls logged
   * all plan applications gated by approval

---
