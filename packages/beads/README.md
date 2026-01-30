# @herbcaudill/beads

Typed TypeScript SDK for the [beads](https://github.com/herbcaudill/beads) issue tracker. Provides a `BeadsClient` class that wraps the `bd` CLI with typed inputs and outputs, plus a daemon socket interface for watching real-time mutation events.

## Install

```bash
npm install @herbcaudill/beads
```

## Usage

```ts
import { BeadsClient } from "@herbcaudill/beads"

const client = new BeadsClient({ cwd: "/path/to/repo" })

// List open issues
const issues = await client.list({ status: "open" })

// Create an issue
const issue = await client.create({
  title: "Fix login bug",
  type: "bug",
  priority: 1,
})

// Update and close
await client.update(issue.id, { status: "in_progress" })
await client.close(issue.id)
```

### Watching for mutations

```ts
const stop = client.watchMutations(event => {
  console.log(`${event.type}: ${event.issueId}`)
})

// Later, stop watching
stop()
```

## API

### `BeadsClient`

CRUD operations spawn `bd` subprocesses. All methods return typed results.

| Method             | Description                                      |
| ------------------ | ------------------------------------------------ |
| `list(options?)`   | List issues with optional filters                |
| `blocked(parent?)` | List blocked issues                              |
| `show(ids)`        | Show details for one or more issues              |
| `listWithParents(options?)` | List issues enriched with parent/dependency data |
| `create(options)`  | Create a new issue                               |
| `update(ids, options)` | Update one or more issues                    |
| `close(ids)`       | Close one or more issues                         |
| `delete(ids)`      | Delete one or more issues                        |
| `addComment(id, comment, author?)` | Add a comment to an issue         |
| `getComments(id)`  | Get comments for an issue                        |
| `getInfo()`        | Get database info                                |
| `getLabels(id)`    | Get labels for an issue                          |
| `addLabel(id, label)` | Add a label to an issue                       |
| `removeLabel(id, label)` | Remove a label from an issue               |
| `listAllLabels()`  | List all unique labels                           |
| `addBlocker(blockedId, blockerId)` | Add a blocking dependency         |
| `removeBlocker(blockedId, blockerId)` | Remove a blocking dependency   |
| `watchMutations(onMutation, options?)` | Watch for real-time mutation events |

### `DaemonSocket`

Low-level Unix socket client for the beads daemon.

### `watchMutations(onMutation, options?)`

Standalone function to watch mutation events from the daemon socket. Returns a cleanup function.

## Types

Key types exported from this package:

- `BdIssue` - Issue object with id, title, status, priority, type, etc.
- `BdCreateOptions` / `BdUpdateOptions` / `BdListOptions` - Options for CRUD operations
- `MutationEvent` - Real-time mutation event from the daemon
- `BdComment`, `BdDependency`, `BdInfo`, `BdLabelResult`, `BdDepResult`
