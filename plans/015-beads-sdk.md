# Beads TypeScript SDK

## Goal

Extract beads integration code into a standalone `packages/beads/` package (`@herbcaudill/beads`) that provides a typed TypeScript SDK for the beads issue tracker. This consolidates the duplicated beads clients (CLI and UI server have separate implementations) and makes beads usable outside of Ralph.

## Current state

Beads code is scattered across three packages:

| Location                                       | What                                                 | How it talks to beads                |
| ---------------------------------------------- | ---------------------------------------------------- | ------------------------------------ |
| `packages/shared/src/beads/types.ts`           | Domain types (`BdIssue`, `BdListOptions`, etc.)      | N/A (types only)                     |
| `packages/ui/server/BdProxy.ts`                | Full CRUD client (~475 lines)                        | Spawns `bd` CLI subprocess           |
| `packages/ui/server/BeadsClient.ts`            | Daemon socket client + mutation watcher (~280 lines) | Unix socket RPC to `.beads/bd.sock`  |
| `packages/cli/src/lib/beadsClient.ts`          | Daemon socket client + issue watcher (~215 lines)    | Unix socket RPC (duplicate of above) |
| `packages/cli/src/lib/captureBeadsSnapshot.ts` | Progress snapshot                                    | `execSync("bd count ...")`           |
| `packages/cli/src/lib/getBeadsProgress.ts`     | Progress computation                                 | `execSync("bd count ...")`           |
| `packages/cli/src/lib/getOpenIssueCount.ts`    | Open issue count                                     | `execSync("bd list ...")`            |

Problems:

1. **Duplication**: Two independent `BeadsClient` socket implementations with near-identical code.
2. **Scattered**: Types in shared, clients in UI server + CLI, progress helpers in CLI.
3. **Not reusable**: Other tools that want to interact with beads programmatically can't.

## Approach

Create `packages/beads/` (`@herbcaudill/beads`) — a single `BeadsClient` class that handles everything:

```
@herbcaudill/beads
├── types.ts          # All domain types (moved from shared)
├── BeadsClient.ts    # Unified client (CRUD via subprocess, mutations via socket)
├── exec.ts           # Subprocess spawning helper (from BdProxy.exec)
├── socket.ts         # Unix socket RPC helper (from BeadsClient)
└── index.ts          # Public exports
```

**Key decisions:**

- **Single `BeadsClient` class** — no transport abstraction. CRUD operations spawn `bd` subprocess internally. `watchMutations()` connects to the daemon socket when available, falls back to polling via `bd list` if the daemon isn't running.
- **Move types from shared** into this package. Re-export from shared for backward compatibility.
- **Progress helpers stay in CLI** — they're Ralph-specific (session-scoped progress tracking). They'll import from `@herbcaudill/beads` instead of spawning `bd` directly.
- **`listWithParents()` enrichment** moves to the SDK since it's general-purpose.

## Public API

```typescript
import { BeadsClient } from "@herbcaudill/beads"

const client = new BeadsClient({ cwd: "/path/to/repo" })

// CRUD — spawns bd subprocess internally
const issues = await client.list({ status: "open" })
const issue = await client.create({ title: "Fix bug", priority: 2 })
await client.update(issue.id, { status: "in_progress" })
await client.close(issue.id)
await client.delete(issue.id)

// Queries
const details = await client.show("r-abc123")
const blocked = await client.blocked()
const enriched = await client.listWithParents({ status: "open" })
const info = await client.getInfo()

// Comments
await client.addComment("r-abc123", "Done", "ralph")
const comments = await client.getComments("r-abc123")

// Labels
const labels = await client.getLabels("r-abc123")
await client.addLabel("r-abc123", "bug")
await client.removeLabel("r-abc123", "bug")
const allLabels = await client.listAllLabels()

// Dependencies
await client.addBlocker("r-blocked", "r-blocker")
await client.removeBlocker("r-blocked", "r-blocker")

// Mutations — uses daemon socket when available, falls back to polling via CLI
const stop = client.watchMutations(event => console.log(event))
// or as a standalone function:
import { watchMutations } from "@herbcaudill/beads"
const stop = watchMutations(event => console.log(event), { cwd: "." })
```

## Tasks

1. **Scaffold `packages/beads/`** — `package.json`, `tsconfig.json`, build/test scripts.
2. **Move types** from `packages/shared/src/beads/` into `packages/beads/src/types.ts`. Re-export from shared for backward compat.
3. **Implement `exec` helper** — extract subprocess-spawning logic from `BdProxy.exec`.
4. **Implement `socket` helper** — consolidate the two `BeadsClient` socket implementations into one module.
5. **Implement `BeadsClient`** — single class with all CRUD methods (via subprocess) and `watchMutations()` (via socket with CLI fallback).
6. **Move `listWithParents` enrichment** into `BeadsClient`.
7. **Update `packages/ui/server/`** — replace `BdProxy` and `BeadsClient` imports with `@herbcaudill/beads`.
8. **Update `packages/cli/`** — replace `beadsClient.ts` with `@herbcaudill/beads`. Update progress helpers.
9. **Update `packages/shared/`** — re-export beads types from `@herbcaudill/beads`.
10. **Tests** — port existing `BdProxy` tests, add tests for socket and unified client.
11. **Verify** — `pnpm typecheck`, `pnpm test:all`, `pnpm build`.

## Resolved questions

1. **Socket transport scope** — No separate transport abstraction. Single `BeadsClient` uses subprocess for CRUD, daemon socket for mutations (with CLI polling fallback).
2. **Progress helpers** — Stay in CLI. They're Ralph-specific.
3. **Publishing** — Workspace package for now. Publish when there's an external consumer.
