# Agent-view

UI components for rendering agent event streams. See the monorepo root `CLAUDE.md` for project-wide instructions.

## Development commands

```bash
pnpm build           # Build with tsc
pnpm typecheck       # Typecheck (no emit)
pnpm test            # Run vitest
pnpm storybook       # Start Storybook on port 6007
```

## Hotkeys module

The `hotkeys/` directory provides a hotkey registration system for host applications. Parallel to the `beads-view` hotkeys module.

**Exports** (from `@herbcaudill/agent-view`):

- `useAgentHotkeys(options)` — React hook that registers global keyboard listeners and invokes handler callbacks. Returns `getHotkeyDisplay(action)` for rendering shortcut labels and `registeredHotkeys` listing all actions.
- `hotkeys` — Parsed hotkey config object (`AgentHotkeysConfig`)
- `getHotkeyDisplayString(config)` — Formats a `HotkeyConfig` as a platform-aware display string (e.g., "⌘L" on Mac, "Ctrl+L" on Windows)
- Types: `AgentHotkeyAction`, `HotkeyConfig`, `HotkeyModifier`, `AgentHotkeysConfig`, `HotkeyHandler`, `UseAgentHotkeysOptions`, `UseAgentHotkeysReturn`

**Available actions** (defined in `hotkeys.json`):
| Action | Key | Description |
|---|---|---|
| `focusChatInput` | `Cmd+L` | Focus chat input |
| `newSession` | `Cmd+Backspace` | New chat session |
| `toggleToolOutput` | `Ctrl+O` | Toggle tool output visibility |
| `scrollToBottom` | `Cmd+↓` | Scroll to bottom |
| `showHotkeys` | `Cmd+/` | Show keyboard shortcuts |

Host applications provide handler callbacks; the hook handles platform-aware key matching and input element filtering.

## Adapter info hooks

Hooks for fetching adapter version and model information from the `/api/adapters` endpoint.

**Exports** (from `@herbcaudill/agent-view`):

- `useAdapterInfo(agentType, serverUrl?)` — Fetches full adapter info (version, model) for the given agent type
- `useAdapterVersion(agentType, serverUrl?)` — Convenience hook returning just the version string
- `formatModelName(modelId)` — Formats a Claude model ID for display (e.g., `"claude-sonnet-4-20250514"` becomes `"Sonnet 4"`)

## Effect Schema cheat sheet

Effect Schema is used for the canonical event schema (single source of truth for types + runtime validation). Import from `effect/Schema`:

```ts
import { Schema as S } from "effect"
```

### Structs

```ts
const Person = S.Struct({
  name: S.String,
  age: S.Number,
})

// Extract the TypeScript type
type Person = S.Schema.Type<typeof Person>
// => { name: string; age: number }
```

### Extending structs

```ts
const Base = S.Struct({ id: S.String, timestamp: S.Number })

const Extended = Base.pipe(
  S.extend(
    S.Struct({
      type: S.Literal("message"),
      content: S.String,
    }),
  ),
)
```

### Literals and unions

```ts
const Status = S.Literal("active", "inactive")
// => "active" | "inactive"

const Event = S.Union(MessageEvent, ToolUseEvent, ErrorEvent)
```

### Optional fields and defaults

```ts
const Config = S.Struct({
  name: S.String,
  verbose: S.optional(S.Boolean),
  // Optional with default — decoded value is always present
  role: S.optional(S.String).pipe(S.withDefault(() => "user")),
})
```

### Property signatures with defaults (for top-level fields)

```ts
const WithId = S.Struct({
  id: S.propertySignature(S.String).pipe(S.withConstructorDefault(() => crypto.randomUUID())),
})
```

### Records and arrays

```ts
S.Record({ key: S.String, value: S.Unknown })
S.Array(S.String)
S.NonEmptyArray(S.Number)
```

### Decoding and encoding

```ts
// Decode unknown data (parse + validate)
const result = S.decodeUnknownSync(MySchema)(rawData) // throws on error
const either = S.decodeUnknownEither(MySchema)(rawData) // Either<A, ParseError>

// Encode (serialize back)
const encoded = S.encodeSync(MySchema)(value)

// With options
S.decodeUnknownEither(MySchema, { errors: "all" })(rawData)
```

### Type extraction

```ts
// Decoded type (what you work with in code)
type MyType = S.Schema.Type<typeof MySchema>

// Encoded type (what comes over the wire)
type MyEncoded = S.Schema.Encoded<typeof MySchema>
```

### Pattern used in this package

The canonical event schema follows this pattern:

```ts
// Base event with auto-generated defaults
const BaseEvent = S.Struct({
  id: S.optional(S.String).pipe(S.withDefault(() => crypto.randomUUID())),
  timestamp: S.optional(S.Number).pipe(S.withDefault(() => Date.now())),
  type: S.String,
})

// Concrete event type extending base
const MessageEvent = BaseEvent.pipe(
  S.extend(
    S.Struct({
      type: S.Literal("message"),
      content: S.String,
      isPartial: S.optional(S.Boolean),
    }),
  ),
)

// Union of all known event types
const CanonicalEvent = S.Union(MessageEvent, ToolUseEvent /* ... */)

// Decode incoming data
const event = S.decodeUnknownSync(CanonicalEvent)(rawEvent)
```
