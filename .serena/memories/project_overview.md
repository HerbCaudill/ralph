# Ralph - Project Overview

Ralph is an autonomous AI session engine that wraps the Claude CLI to run iterative development workflows. It spawns Claude CLI processes with custom prompts and todo lists, captures streaming JSON output, and orchestrates multiple sessions.

## Tech Stack
- **Language:** TypeScript (strict, ES modules)
- **Runtime:** Node.js 24.x (pinned 24.13.0 in `.prototools`)
- **Package Manager:** pnpm (workspace monorepo)
- **Frontend:** React 19, Vite 7, Tailwind CSS 4, Zustand 5, Radix UI, Storybook 10
- **Backend:** Express 5, WebSocket (ws)
- **CLI:** Ink 6 (React for CLIs), Commander 14
- **Testing:** Vitest 4 (unit), Playwright (E2E)
- **Formatting:** Prettier 3
- **Icons:** Tabler Icons
- **Fonts:** IBM Plex

## Monorepo Structure (pnpm workspace)
- `packages/cli/` (`@herbcaudill/ralph`) — CLI tool, published to npm
- `packages/ui/` (`@herbcaudill/ralph-ui`) — Web app: Express server + React frontend
- `packages/shared/` (`@herbcaudill/ralph-shared`) — Shared utilities and types
- `packages/beads-view/` — Task management UI/state extraction (in progress)
- `packages/agent-view/`, `packages/agent-view-claude/`, `packages/agent-view-codex/`, `packages/agent-view-theme/` — Agent view packages

## Issue Tracking
Uses `bd` (beads) for all issue tracking. Git-backed JSONL format.
