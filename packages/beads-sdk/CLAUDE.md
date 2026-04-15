# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Typed TypeScript SDK for the [beads](https://github.com/gastownhall/beads) issue tracker. Zero runtime
dependencies. Connects to beads v1 through the supported `bd --json` CLI, with JSONL file fallback
for read-only/offline scenarios when an exported `.beads/issues.jsonl` file is available.

## Commands

```bash
pnpm build          # Compile TypeScript to dist/
pnpm dev            # Watch mode compilation
pnpm typecheck      # Type-check without emitting
pnpm test           # Run tests (vitest)
pnpm test:watch     # Run tests in watch mode
pnpm format         # Format with Prettier
```

## Architecture

```
React App <-> Backend API (localhost) <-> BeadsClient
                                              |-- CliTransport     (bd --json subprocesses)
                                              |-- JsonlTransport   (fallback: parse exported .beads/issues.jsonl)
```

Nine modules, all ESM:

- **`transport/cli.ts`** — Sends operations to beads v1 through `bd --json` subprocesses. Serializes
  calls within one client to avoid embedded-Dolt lock contention. Parses JSON output even when the
  CLI prints setup text before the payload.
- **`transport/daemon.ts`** — Legacy low-level transport for pre-v1 daemon workspaces. The high-level
  client no longer uses it.
- **`transport/jsonl.ts`** — Parses `.beads/issues.jsonl` into an in-memory `Map<string, Issue>`.
  Supports read-only operations (list, show, ready, blocked, stats). Watches file via `fs.watch()`
  and reloads on change. Used as fallback when `bd` cannot read the workspace.
- **`transport/discovery.ts`** — Discovers `.beads/bd.sock` and `.beads/issues.jsonl` by walking up
  the directory tree from the workspace root.
- **`client.ts`** — High-level `BeadsClient` combining CliTransport + JsonlTransport. Full CRUD plus
  comments, labels, and dependencies via the CLI; reads fall back to JSONL. Change detection via
  `ChangePoller` (polls CLI stats). Exports the legacy `watchMutations` convenience function.
- **`poller.ts`** — `ChangePoller` polls the active transport's `stats` endpoint on a configurable interval
  and emits change events to subscribers. Uses a `polling` guard flag to prevent overlapping
  requests; interval ticks that fire while a poll is in flight are skipped.
- **`mutation-poller.ts`** — Legacy daemon mutation poller. Beads v1 CLI transport does not expose
  detailed mutation events.
- **`batch.ts`** — `batched()` utility for running async operations with bounded concurrency
  (default 10). Used by `showMany`, `updateMany`, `deleteMany` on the client.
- **`registry.ts`** — Reads the legacy global beads registry (`~/.beads/registry.json`) when present.

`types.ts` holds all shared type definitions. `index.ts` is the barrel export.

## Beads v1 CLI transport

The high-level client probes `bd info` to confirm the workspace is readable, then maps SDK operations
to `bd` commands such as `list --json`, `show --json`, `ready --json`, `status --json --no-activity`,
`create --json`, `update --json`, `close --json`, `comments`, `label`, and `dep`. `get_mutations` is
not supported by the v1 CLI transport.

## Testing

Tests use Vitest. Tests for the CLI transport use temporary executable fixtures. Tests for the JSONL
transport and discovery module use temporary directories with real files. Tests for the legacy daemon
transport use a mock Unix socket server to exercise response framing scenarios. Tests for the poller
use mock transports and fake timers. Client tests cover both CLI and JSONL fallback paths.

## Issue tracking

This project uses **bd** (beads) for issue tracking. Run `bd onboard` to get started.

```bash
bd ready                                     # Find available work
bd show <id>                                 # View issue details
bd update <id> --status in_progress          # Claim work
bd close <id>                                # Complete work
bd sync                                      # Sync with git
```
