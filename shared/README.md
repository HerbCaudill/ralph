# @herbcaudill/ralph-shared

Shared utilities and types for Ralph CLI and UI packages.

## Overview

This package provides common types and utilities used by both the Ralph CLI (`@herbcaudill/ralph`) and UI (`@herbcaudill/ralph-ui`) packages. By centralizing these definitions, we ensure consistency across the codebase and reduce duplication.

## Installation

```bash
pnpm add @herbcaudill/ralph-shared
```

## Contents

### Agent Events (`events/`)

Normalized event types for agent communication. All agent adapters (Claude, Codex, etc.) translate their native events into these standard types.

**Types:**

- `AgentMessageEvent` - Text message from the assistant
- `AgentToolUseEvent` - Tool invocation by the assistant
- `AgentToolResultEvent` - Result of a tool invocation
- `AgentResultEvent` - Final result of an agent run
- `AgentErrorEvent` - Error from the agent
- `AgentStatusEvent` - Agent status change
- `AgentEvent` - Union type of all events
- `AgentStatus` - Possible agent statuses (`idle`, `starting`, `running`, `paused`, `stopping`, `stopped`)

**Type Guards:**

- `isAgentMessageEvent(event)` - Check if event is a message
- `isAgentToolUseEvent(event)` - Check if event is a tool use
- `isAgentToolResultEvent(event)` - Check if event is a tool result
- `isAgentResultEvent(event)` - Check if event is a result
- `isAgentErrorEvent(event)` - Check if event is an error
- `isAgentStatusEvent(event)` - Check if event is a status change

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
- `initPrompt(options)` - Initialize a prompt by copying default to custom directory
- `getCustomPromptPath(options)` - Get the path to a custom prompt file
- `hasCustomPrompt(options)` - Check if a custom prompt file exists

**Types:**

- `LoadPromptOptions` - Configuration for loading a prompt file
- `LoadPromptResult` - Result from loading a prompt file

## Usage

```typescript
import {
  // Agent events
  AgentEvent,
  AgentMessageEvent,
  isAgentMessageEvent,

  // Beads types
  BdIssue,
  IssueStatus,

  // Prompt loading
  loadPrompt,
  initPrompt,

  // Version
  VERSION,
} from "@herbcaudill/ralph-shared"

// Type guard example
function handleEvent(event: AgentEvent) {
  if (isAgentMessageEvent(event)) {
    console.log("Message:", event.content)
  }
}

// Load prompt with customization
const result = loadPrompt({
  filename: "prompt.md",
  customDir: ".ralph",
  defaultPath: "/path/to/default/prompt.md",
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
