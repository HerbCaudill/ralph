# @herbcaudill/beads-sdk

Typed TypeScript SDK for the [beads](https://github.com/gastownhall/beads) issue tracker. Zero runtime dependencies.

Connects to beads v1 through the supported `bd --json` CLI, with JSONL file fallback for read-only/offline scenarios when an exported `.beads/issues.jsonl` file is available.

## Install

```bash
pnpm add @herbcaudill/beads-sdk
```

## Usage

```ts
import { BeadsClient } from "@herbcaudill/beads-sdk"

const client = new BeadsClient()
await client.connect("/path/to/repo")

// List open issues
const issues = await client.list({ status: "open" })

// Create an issue (requires writable bd CLI access)
const issue = await client.create({
  title: "Fix login bug",
  priority: 1,
  issue_type: "bug",
})

// Update an issue
await client.update(issue.id, { status: "in_progress" })

// Close an issue
await client.close(issue.id)

// Delete an issue
await client.delete(issue.id)

// Clean up
await client.disconnect()
```

### Filtering

```ts
// Filter by status, priority, type, assignee, or labels
const bugs = await client.list({ issue_type: "bug", status: "open" })
const labeled = await client.list({ labels: ["frontend", "urgent"] }) // all required
const any = await client.list({ labels_any: ["frontend", "backend"] }) // any match

// Text search across title
const results = await client.list({ query: "login" })

// Get only ready issues (open and unblocked)
const ready = await client.ready({ assignee: "herb", limit: 5 })

// Get blocked issues
const blocked = await client.blocked()

// Get database statistics
const stats = await client.stats()
```

### Batch operations

```ts
// Show details for multiple issues (bounded concurrency)
const issues = await client.showMany(["abc", "def", "ghi"])

// Update multiple issues at once
await client.updateMany(["abc", "def"], { status: "in_progress" })

// Delete multiple issues
await client.deleteMany(["abc", "def"])
```

### Comments

```ts
// Add a comment
await client.addComment(issueId, "Looks good to me", "herb")

// Get all comments for an issue
const comments = await client.getComments(issueId)
```

### Labels

```ts
// Get labels for an issue
const labels = await client.getLabels(issueId)

// Add/remove labels
await client.addLabel(issueId, "frontend")
await client.removeLabel(issueId, "backend")

// List all labels in the database
const allLabels = await client.listAllLabels()
```

### Dependencies

```ts
// Add a dependency with explicit type
await client.addDependency(childId, parentId, "blocks")

// Convenience methods for blocking dependencies
await client.addBlocker(blockedId, blockerId)
await client.removeBlocker(blockedId, blockerId)
```

### Diagnostics

```ts
// Check connection status
client.isConnected()

// Ping the bd CLI
const pong = await client.ping()

// Get CLI health info
const health = await client.health()

// Get database info
const info = await client.info()
```

### Watching for changes

The SDK polls `bd status --json --no-activity` for changes and can notify you when data updates:

```ts
const unsub = client.onChange(() => {
  console.log("Data changed, refetch!")
})

// Later, stop watching
unsub()
```

Detailed daemon mutation events are not available in the v1 CLI transport.

### Registry

Discover available beads workspaces from the global registry:

```ts
import { getAliveWorkspaces } from "@herbcaudill/beads-sdk"

// Get workspaces with live registered processes
const workspaces = getAliveWorkspaces("/current/repo")
```

### Configuration

```ts
const client = new BeadsClient({
  requestTimeout: 10000, // CLI request timeout in ms (default: 10000)
  actor: "my-app", // Actor name sent with requests (default: "sdk")
  pollInterval: 2000, // Change polling interval in ms (default: 2000)
  bdPath: "bd", // Optional path to the bd executable
})
```

### Low-level access

For direct transport usage:

```ts
import { CliTransport, JsonlTransport } from "@herbcaudill/beads-sdk"

// Direct CLI communication
const cli = new CliTransport("/path/to/repo")
const issues = await cli.send("list", { status: "open" })
cli.close()

// JSONL file access (read-only)
const jsonl = new JsonlTransport("/path/to/repo")
jsonl.load()
const ready = await jsonl.send("ready", {})
jsonl.close()
```

## Architecture

```
BeadsClient
  |-- CliTransport     (bd --json subprocesses)
  |-- JsonlTransport   (fallback: parse exported .beads/issues.jsonl)
  |-- ChangePoller     (polls stats for change detection)
  |-- MutationPoller   (legacy daemon-only mutation endpoint)
```

- **CliTransport**: Runs `bd` commands with `--json`, serializing calls within one client to avoid embedded-Dolt lock contention.
- **JsonlTransport**: Read-only fallback. Parses `.beads/issues.jsonl` into memory when that export exists. Watches the file for changes via `fs.watch()`.
- **ChangePoller**: Polls `bd status --json --no-activity` and emits change events when data changes. Set `pollInterval: 0` to disable polling.
- **DaemonTransport**: Legacy low-level transport for pre-v1 daemon workspaces. The high-level client no longer uses it.

## License

MIT
