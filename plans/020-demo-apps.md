# Demo Apps for Beads + Agent Chat

## Goal

Create minimal demo apps that showcase beads tasks and agent chat wrappers for Claude Code and Codex.

## Approach

- Add two demo packages: `demo-agent-chat` (Claude Code + Codex options) and `demo-beads`.
- The chat demo exercises send/stream and clear-context for both agents.
- The beads demo talks to real local beads instances and includes a workspace chooser that queries the beads registry.

## Tasks

1. Define demo package layout, build scripts, and dev commands.
2. Add demo shell(s) per package (layout, routing, nav) with IBM Plex + Tabler defaults.
3. Implement agent chat demo (Claude Code + Codex selection, connect, send, stream, clear context, status).
4. Implement beads task manager demo (workspace chooser via beads registry, list/create/update tasks).
5. Add README + run instructions; ensure builds/tests cover the new packages.

## Unresolved Questions

- None.
