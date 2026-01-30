# Agent view package

## Goal

Extract a standalone UI package that renders agent event streams (with defaults and slots) and can be reused by CLI web UIs.

## Approach

Create a new workspace package `@herbcaudill/agent-view` with a high-level `AgentView` component plus exported primitives (`AutoScroll`, `EventDisplay`, `TokenUsageDisplay`, `ContextWindowProgress`). Keep it UI-only: data and commands flow via props/callbacks. Provide default spinner and scroll-to-bottom button that can be overridden via slots/props. Add a common event model and adapter interface in `@herbcaudill/agent-view`, with separate adapter packages (e.g., `@herbcaudill/agent-view-claude`, `@herbcaudill/agent-view-codex`) that translate native events into the common format. Split VS Code theme conversion into a sibling package (e.g., `@herbcaudill/agent-view-theme`) that can emit CSS variables via a React `<ThemeVariables />` component and a pure function; hosts opt in. Assume the host app provides Tailwind and the CSS variables.

## Tasks

1. Define the public API (components, props/slots, types) and target folder layout for `@herbcaudill/agent-view`.
2. Set up new workspace packages (agent-view, agent-view-theme, adapter packages) with build/exports/peer deps.
3. Add a common event model and adapter interface in `@herbcaudill/agent-view`.
4. Implement Claude and Codex adapter packages that map native events to the common model.
5. Extract shared UI components/hooks from `packages/ui/` into the new package and adapt them to be store-agnostic.
6. Add `AgentView` composition with sensible defaults (spinner, scroll button, empty state, token/context widgets) and slots: `header`, `footer`, `input`, `emptyState`, `loadingIndicator`, and scroll button override.
7. Create sibling package for VS Code theme → CSS variable mapping and document required CSS variables.
8. Update `packages/ui/` to use the new packages.
9. Add tests/stories for the new package(s) and update docs/README as needed.
