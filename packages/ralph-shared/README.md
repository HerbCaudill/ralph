# @herbcaudill/ralph-shared

Shared utilities and types for Ralph CLI and UI packages.

## Overview

This package provides common types and utilities used by both the Ralph CLI (`@herbcaudill/ralph`) and UI (`@herbcaudill/ralph-ui`) packages. By centralizing these definitions, we ensure consistency across the codebase and reduce duplication.

## Installation

```bash
pnpm add @herbcaudill/ralph-shared
```

## Contents

### Beads Domain Types (`beads/`)

Types for interacting with the beads issue tracking system.

**Types:**

- `BdIssue` - An issue from the beads database
- `BdDependency` - A dependency relationship between issues
- `BdListOptions` - Options for listing issues
- `BdCreateOptions` - Options for creating a new issue
- `BdUpdateOptions` - Options for updating an existing issue
- `BdInfo` - Information about the beads database
- `BdLabelResult` - Result of a label operation
- `BdComment` - A comment on an issue
- `IssueStatus` - Status of an issue (`open`, `in_progress`, `blocked`, `deferred`, `closed`)
- `MutationType` - Type of mutation event from the beads daemon
- `MutationEvent` - A mutation event from the beads daemon

### Prompt Loading (`prompts/`)

Utilities for loading and managing prompt files with customization support.

**Functions:**

- `loadPrompt(options)` - Load a prompt file with fallback to default
- `loadSessionPrompt(options)` - Combine core prompt with workflow prompt
- `getWorkspaceRoot(cwd?)` - Resolve the repo root (nearest `.git`)

**Types:**

- `LoadPromptOptions` - Configuration for loading a prompt file
- `LoadPromptResult` - Result from loading a prompt file

## Subpath Exports

The main entry point is browser-safe. Node-only utilities are available via separate subpaths:

- `@herbcaudill/ralph-shared` — Browser-safe: events, beads types
- `@herbcaudill/ralph-shared/prompts` — Node-only: prompt loading utilities (uses `node:fs`)
- `@herbcaudill/ralph-shared/server` — Node-only: session persistence utilities (uses `node:fs`, `node:os`)

## Usage

```typescript
// Browser-safe imports (types)
import { BdIssue, IssueStatus } from "@herbcaudill/ralph-shared"

// Agent event types are in @herbcaudill/agent-view (canonical)
// or @herbcaudill/agent-server (backward-compatible aliases)
import type { MessageEventType } from "@herbcaudill/agent-view"
import type { AgentEvent } from "@herbcaudill/agent-server"

// Node-only imports (prompt loading)
import { loadPrompt } from "@herbcaudill/ralph-shared/prompts"

// Node-only imports (session persistence)
import { SessionPersister, getDefaultStorageDir } from "@herbcaudill/ralph-shared/server"

// Load prompt with customization (Node.js only)
const result = loadPrompt({
  filename: "prompt.prompt.md",
  customDir: ".ralph",
  defaultPath: "/path/to/default/prompt.prompt.md",
})
console.log(result.content, result.isCustom)
```

## Development

```bash
# Build
pnpm build

# Run tests
pnpm test

# Type checking
pnpm typecheck

# Format code
pnpm format
```

## License

MIT
