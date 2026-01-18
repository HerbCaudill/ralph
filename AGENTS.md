# Agent Instructions

This project uses **bd** (beads) for issue tracking. Run `bd onboard` to get started.

## Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --status in_progress  # Claim work
bd close <id>         # Complete work
bd sync               # Sync with git
```

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd sync
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**

- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds

## SDK Reference: Streaming Input for User Messages

The Claude Agent SDK supports two input modes:

### Single Message Mode (current ralph implementation)

```typescript
query({ prompt: "string prompt", options: {...} })
```

### Streaming Input Mode (for runtime user input)

```typescript
query({ prompt: asyncGenerator(), options: {...} })
```

To send user messages while Claude is working, use streaming input mode:

1. **Create an async generator** that yields `SDKUserMessage` objects
2. **Pass it to `query()`** as the `prompt` parameter
3. **Yield additional messages** from outside the generator when the user types

**SDKUserMessage structure:**

```typescript
type SDKUserMessage = {
  type: "user"
  message: MessageParam // { role: 'user', content: string | ContentBlock[] }
  parent_tool_use_id: string | null
  session_id: string
  isSynthetic?: boolean
  uuid?: UUID
}
```

**Example pattern:**

```typescript
// Create a message queue that can be pushed to from UI
const messageQueue: SDKUserMessage[] = []
let resolveWaiting: (() => void) | null = null

async function* messageGenerator(): AsyncGenerator<SDKUserMessage> {
  // Yield initial prompt
  yield {
    type: "user",
    message: { role: "user", content: initialPrompt },
    parent_tool_use_id: null,
    session_id: "", // SDK fills this in
  }

  // Wait for and yield additional messages
  while (true) {
    if (messageQueue.length > 0) {
      yield messageQueue.shift()!
    } else {
      await new Promise<void>(resolve => {
        resolveWaiting = resolve
      })
    }
  }
}

// Push message from UI handler
function sendUserMessage(text: string) {
  messageQueue.push({
    type: "user",
    message: { role: "user", content: text },
    parent_tool_use_id: null,
    session_id: "",
  })
  resolveWaiting?.()
}

// Start the query
for await (const message of query({ prompt: messageGenerator() })) {
  // Process messages
}
```

**Note:** The `Query.streamInput()` method exists but is marked as "used internally for multi-turn conversations." The documented approach is to pass an async generator to `query()` directly.
