# Beads View Extraction

## Goal

Extract task management UI + state into `packages/beads-view` so it is testable and reusable independently of task chat and ralph loop.

## Approach

- Define beads-view scope: task list/sidebar, search, quick add, task details/editing, related tasks/graph, progress indicators; exclude task chat and ralph loop/event log.
- Create a new workspace package `packages/beads-view` with its own `src/` structure (components, hooks, lib, store, types).
- Move task-related hooks, lib utilities, and types into beads-view; keep one function per file and shared types/constants in `types.ts`/`constants.ts`.
- Extract task-related store state into a beads-view slice (or local store) and have `packages/ui` compose it into the global store.
- Add a beads-view task API client with a configurable fetch/base URL, and extract server task routes into a dedicated module to formalize the boundary.
- Update `packages/ui` imports to consume beads-view exports; keep storybook/tests green and update docs/CLAUDE as needed.

## Tasks

1. Inventory current task-management files (components, hooks, store state, lib utilities, tests, stories) and map to beads-view scope.
2. Scaffold `packages/beads-view` (package.json, tsconfig, entry exports) and wire into pnpm workspace.
3. Move task-related types/lib utilities and update imports/tests.
4. Move task-related hooks and store slice; integrate with `packages/ui` store composition.
5. Move task UI components (list, details/editing, search, quick add, related tasks, progress) with tests/stories updated.
6. Extract server task routes into a module and introduce a beads-view task API client boundary.
7. Update docs/CLAUDE, run format/build/tests.

## Unresolved Questions

- What should the initial public export surface of beads-view include (components/hooks/store helpers)?
- Should beads-view own its own store, or expose a slice for the host app to compose?
- Do we need a configurable API client interface now (base URL, fetch injection), or keep it minimal and refactor later?
