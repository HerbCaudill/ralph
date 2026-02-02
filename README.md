# Ralph

Autonomous AI session engine for Claude CLI. Ralph spawns Claude CLI processes with custom prompts, captures streaming output, and orchestrates multiple sessions to complete tasks autonomously.

## Packages

This monorepo contains the following packages:

| Package                                               | Description                                                        |
| ----------------------------------------------------- | ------------------------------------------------------------------ |
| [`@herbcaudill/ralph`](packages/cli/)                 | CLI tool for terminal-based sessions                               |
| [`@herbcaudill/ralph-ui`](packages/ui/)               | Web UI with real-time event streaming                              |
| [`@herbcaudill/ralph-shared`](packages/shared/)       | Shared types and utilities                                         |
| [`@herbcaudill/beads-view`](packages/beads-view/)     | Task management UI, state, hooks, and API client                   |
| [`@herbcaudill/beads-server`](packages/beads-server/) | Standalone server for beads task management (HTTP + WebSocket)     |
| [`@herbcaudill/agent-server`](packages/agent-server/) | Standalone server for managing AI coding agents (HTTP + WebSocket) |
| [`@herbcaudill/demo-agent-chat`](packages/demo-agent-chat/) | Demo app for agent chat with Claude Code and Codex |
| [`@herbcaudill/demo-beads`](packages/demo-beads/) | Demo app for beads task manager UI |

## Installation

```bash
# CLI only
npm install -g @herbcaudill/ralph

# Web UI
npm install -g @herbcaudill/ralph-ui
```

## Quick start

### CLI

```bash
# Initialize Ralph in your project
ralph init

# Run sessions (default: 10)
ralph

# Run specific number of sessions
ralph 5

# Watch mode: poll for new tasks after completion
ralph --watch
```

### Web UI

```bash
# Start the UI server
ralph-ui start --open
```

The UI provides real-time monitoring, task management, and support for multiple AI agents (Claude, Codex).

## How it works

1. Ralph combines a core prompt with your project's `.ralph/workflow.md` (resolved from the repo root)
2. Spawns Claude CLI with `--output-format stream-json`
3. Claude checks for errors, finds available tasks via `bd ready`, and works through them
4. Outputs `<start_task>` and `<end_task>` markers as it works
5. Exits when no tasks remain (`<promise>COMPLETE</promise>`)

Ralph integrates with [beads](https://github.com/HerbCaudill/beads) for issue tracking, but works without it too.

## Development

```bash
# Use Node.js 24.x (repo pins 24.13.0 in .prototools)
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run all tests
pnpm test:all

# Start UI in development (combined server mode)
pnpm dev

# Start in split server mode (beads-server:4243 + agent-server:4244 + UI:5179)
pnpm dev:split

# Start individual servers
pnpm serve:beads    # Beads server only (port 4243)
pnpm serve:agent    # Agent server only (port 4244)

# Run demo apps
pnpm demo:agent-chat  # Agent chat demo (port 5180)
pnpm demo:beads       # Beads task manager demo (port 5181)

# Format code
pnpm format
```

Unit tests focus on behavioral coverage; avoid type-only guard tests.

UI components follow the controller/presentational pattern: connected components use a `Controller` suffix (e.g. `HeaderController`), and presentational components use the base name (e.g. `Header`).

## UX specification

The web client UX-only functional spec (with screenshots) lives in `spec/web-client-ux-functional-spec.md`.

## Server architecture

Ralph supports two deployment modes:

- **Combined mode** (default): A single server on port 4242 handles all API routes and WebSocket connections. Use `pnpm dev` or `pnpm serve`.
- **Split mode**: Two separate servers run independently — a **beads-server** (port 4243) for task/workspace management, and an **agent-server** (port 4244) for AI agent control and chat. Use `pnpm dev:split`.

In split mode, the UI automatically routes API requests and WebSocket connections to the correct server based on path prefixes (`/api/tasks`, `/api/labels`, `/api/workspace` → beads-server; `/api/ralph`, `/api/task-chat`, `/api/instances` → agent-server).

## Environment variables

| Variable                | Description                                    | Required       |
| ----------------------- | ---------------------------------------------- | -------------- |
| `ANTHROPIC_API_KEY`     | API key for Claude                             | Yes for Claude |
| `OPENAI_API_KEY`        | API key for Codex                              | Optional       |
| `WORKSPACE_PATH`        | Workspace directory (default: repo root)       | No             |
| `HOST`                  | Server bind address (default: 127.0.0.1)       | No             |
| `PORT`                  | Server port (default: 4242)                    | No             |
| `BEADS_PORT`            | Beads server port (default: 4243)              | No             |
| `AGENT_SERVER_HOST`     | Agent server bind address (default: localhost) | No             |
| `AGENT_SERVER_PORT`     | Agent server port (default: 4244)              | No             |
| `VITE_SPLIT_SERVERS`    | Enable split-server mode in the UI             | No             |
| `VITE_BEADS_SERVER_URL` | Explicit beads-server URL in split mode        | No             |
| `VITE_AGENT_SERVER_URL` | Explicit agent-server URL in split mode        | No             |

## License

MIT

## Author

Herb Caudill
