# Split servers

## Goal

Split the current combined server into separate beads and agent servers so each package can run and be tested independently.

## Approach

Extract server responsibilities into two packages with their own entry points and APIs, update the UI to connect to both, and keep the current single-server path available until migration is complete.

## Tasks

1. Inventory current server responsibilities, routes, sockets, and shared types.
2. Create `packages/beads-server` with its own entry, config, and API surface.
3. Create `packages/agent-server` with its own entry, config, and API surface.
4. Update UI client to connect to both servers (HTTP + WebSocket), with clear error states.
5. Update dev scripts to run both servers and UI together; keep single-server scripts for now.
6. Add per-package tests and minimal integration coverage.
7. Update docs/CLAUDE with new architecture and run instructions.

## Unresolved Questions

- None.
