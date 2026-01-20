## Handover update: extend Strudel via your fork, keep Strudel as a separate module for clean merges

You forked Strudel to `https://codeberg.org/laubsauger/strudel`. Codeberg is blocked from automated fetching in this environment, so the handover below treats that URL as the authoritative Strudel source and focuses on a workflow that keeps merges clean.

Upstream context that matters for merges: the original GitHub repo is archived and development moved to Codeberg. ([GitHub][1])

---

## 1) Recommended integration strategy

### Goal

Strudel stays “its own project” and you add features without turning your product repo into a permanent fork swamp.

### Approach

Use Strudel as a git submodule pointing to your fork, and keep almost all new code in your product repo as an “extensions” package.

You only maintain a tiny patch on the Strudel fork that loads an external extensions package at runtime.

Result:

* Strudel stays separate.
* Your changes are mostly outside Strudel.
* Rebasing your fork onto upstream touches only a couple of small hook files.

---

## 2) Repo topology

### Main product repo (new or existing)

```
/apps/companion                 # Node runtime: timing authority, OSC, MCP, observability
/packages/protocol              # WS message types and versioning
/packages/schemas               # zod schemas: plan, action, chunk, snippet, llmCall
/packages/engine                # scheduler and action executor logic
/packages/llm                   # provider wrappers, pricing config, call logging
/packages/observability         # budgets, aggregation, UI hooks
/packages/snippets              # snippet store API and implementations
/packages/strudel-extensions    # ALL UI panels and Strudel UI augmentation
/vendor/strudel                 # git submodule pointing to your fork
/patches/strudel                # minimal patch series for extension hook
```

### Strudel fork (your Codeberg repo)

* Stays mostly upstream.
* Only contains the “extension host hook” that imports your `@your-scope/strudel-extensions` package when present.

---

## 3) Minimal patch to Strudel fork

### Patch intent

Add a single integration point that allows Strudel to load external UI panels and behaviors.

### What the patch should do

1. Add an `ExtensionHost` mount location in the Strudel UI layout.
2. Add a dynamic import like:

* Attempt to import `@your-scope/strudel-extensions`
* If missing, fail silently and keep Strudel unchanged

3. Provide a small API surface that extensions can use, such as:

* get current code buffer contents
* subscribe to Strudel eval events
* add UI panels
* register commands and keybinds
* connect to companion WebSocket and display transport state

Keep this patch extremely small. Everything else lives in `packages/strudel-extensions`.

---

## 4) How to develop without friction

### Local dev workflow

* Run Strudel UI from `/vendor/strudel` as usual.
* In the same monorepo, the extensions package is available via workspace resolution.
* The Strudel UI imports the extensions package through the hook.

This gives you:

* Native Strudel UX
* Your panels (Loop Station, Assistant, Snippets, Observability) appear as additions
* Zero separate learning curve for Strudel users

### Packaging workflow

You have two clean options:

* Bundle Strudel UI and extensions together in the final build, still keeping code separated in repo.
* Or build Strudel UI, with extensions compiled in as a dependency.

---

## 5) Keeping merges clean on the Strudel fork

### Remotes

* `origin` points to your fork: `laubsauger/strudel`
* `upstream` points to the canonical Codeberg Strudel repo (uzu)

### Policy

* Your fork only contains the tiny hook patch.
* Your product repo contains all feature work.

### Update process

1. Rebase your fork onto upstream regularly.
2. Resolve conflicts only in the hook files, not across the codebase.
3. Run a small integration test suite in the product repo that boots Strudel plus extensions.

---

## 6) Adapting the existing outline to “Strudel as module”

Everything from the earlier outline remains, with one change: the UI is Strudel plus extensions, not a new Next.js IDE shell.

### UI surface

The “IDE” look comes from:

* Strudel UI as the core editor and player
* Extensions add panels:

  * Loop Station (sequencer grid)
  * Assistant (plan, approve, apply, tool feed)
  * Snippets and Projects
  * Observability (tokens and cost)

### Path B stability

Unchanged:

* Companion process owns timing, scheduling, OSC output, MCP tools.
* UI is a thin controller plus visualization.

### LLM observability from day 1

Unchanged:

* All LLM calls go through a single wrapper in `/packages/llm`.
* Every call is logged with token counts and cost estimate.
* UI panel shows live calls and session totals.
* Hard stop blocks plan.apply and any write tool calls.

---

## 7) Concrete task list for Codex, based on this adapted plan

### Task 1: Product repo scaffold

* Create monorepo with the packages listed in section 2.
* Add `/vendor/strudel` submodule pointing to your Codeberg fork.

### Task 2: Strudel hook patch

* Implement ExtensionHost mount point and dynamic import.
* Expose a minimal extension API object.

Acceptance: Strudel runs unchanged if extensions are absent.

### Task 3: Companion runtime skeleton

* WebSocket server with protocol validation.
* Transport clock emits transport.state at step boundaries.
* Scheduler executes no-op actions deterministically.
* Observability event stream exists.

Acceptance: Strudel UI shows transport ticks and scheduled markers.

### Task 4: Extensions package v0

* Renders empty panels in Strudel layout.
* Connects to companion WS.
* Shows connection status and transport state.

Acceptance: Panels render without impacting normal Strudel usage.

### Task 5: Loop Station v1

* Step grid, chunk lanes, markers.
* Schedule actions and visualize scheduled vs executed.

Acceptance: actions execute on the intended boundary and status updates in UI.

### Task 6: Observability v1

* LLM call log store and UI list.
* Token counts, cost estimates, session totals, budget enforcement.

Acceptance: hard stop prevents apply operations, all calls visible.

### Task 7: Assistant plan flow v1

* Propose plan JSON, render structured plan, approve, apply.
* Apply schedules actions in companion and updates visualization.

Acceptance: no action executes without approval, full audit trail.

### Task 8: MCP v1

* Expose the same control surface to Codex through MCP tools.
* Tool calls are logged into observability.

Acceptance: external agent activity is visible inside the UI.

---

## 8) One key design decision to make now

Where the extensions live at runtime:

1. Workspace dependency only (simplest for development).
2. Published package `@your-scope/strudel-extensions` consumed by Strudel build (better for distribution).

Start with 1 and switch to 2 when you package a release.

---

If you paste the current Strudel repo structure you are using (packages, app entrypoint, build tool), I will write the exact “hook patch” plan as a file-by-file checklist that targets your fork precisely, plus the exact package boundaries for `packages/strudel-extensions` and the companion protocol.

[1]: https://github.com/tidalcycles/strudel?utm_source=chatgpt.com "tidalcycles/strudel: MOVED TO CODEBERG"
