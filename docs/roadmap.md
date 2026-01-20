# Roadmap Checklist

## Milestone 0: Companion boot + embedded player skeleton
- [ ] Create companion app skeleton with HTTP + WebSocket servers.
- [ ] Add `/player` page and embed it in the IDE.
- [ ] Establish connection status in the IDE UI.

## Milestone 1: Observability foundation
- [ ] Implement LLM client wrapper and usage logging.
- [ ] Add LLM Observatory panel (call list, totals, budget controls).

## Milestone 2: Editor and manual run via companion
- [ ] Wire editor chunk updates through the companion runtime.
- [ ] Show transport state from the companion in the IDE.

## Milestone 3: Sequencer scheduling in companion
- [ ] Implement scheduling bridge and deterministic execution order.
- [ ] Visualize scheduled actions on the grid.

## Milestone 4: Assistant plan then execute
- [ ] Add plan proposal/approval flow in the assistant panel.
- [ ] Log tool calls and plan execution results.
