# Event Filtering Pipeline

This document describes the complete event filtering pipeline in the Ralph UI. Events pass
through multiple layers of transformation and filtering before being rendered.

## Overview

Events flow from raw server events to rendered UI through **four distinct filtering layers**:

```
Raw Events (ChatEvent[])
        │
        ▼
┌───────────────────────────────────────┐
│ Layer 1: useStreamingState            │
│ (Deduplication & Streaming Synthesis) │
└───────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────┐
│ Layer 2: EventDisplay                 │
│ (Window Slicing)                      │
└───────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────┐
│ Layer 3: EventStreamEventItem         │
│ (Event Type Routing)                  │
└───────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────┐
│ Layer 4: renderEventContentBlock      │
│ (Content Block Rendering)             │
└───────────────────────────────────────┘
        │
        ▼
    Rendered UI
```

## Layer 1: useStreamingState (hooks/useStreamingState.ts)

**Purpose:** Deduplicates events and synthesizes streaming content into complete messages.

**Input:** Raw `ChatEvent[]` from server/WebSocket.

**Output:** `{ completedEvents: ChatEvent[], streamingMessage: StreamingMessage | null }`

### What Gets Filtered

1. **Duplicate `assistant` events**: When Claude streams a response, the SDK emits both:
   - `stream_event` deltas (for real-time UI updates)
   - A final `assistant` event (for completeness)

   This layer removes the duplicate `assistant` events using two strategies:
   - **Message ID matching** (preferred): If the assistant event's message ID matches a
     synthesized streaming message, it's dropped
   - **Timestamp proximity fallback** (legacy): For data without message IDs, events within
     1 second of a `message_stop` are considered duplicates

2. **In-progress streaming**: `stream_event` messages are accumulated into a single
   `StreamingMessage` object (not passed to `completedEvents`)

### Filtering Logic

```typescript
// Assistant events are filtered if they match a streamed message
if (event.type === "assistant") {
  if (shouldDeduplicateAssistant(event, ...)) {
    continue // Skip - duplicate of streamed message
  }
}
completedEvents.push(event)
```

### Key Constants

- `COMPLETED_MESSAGE_DEDUP_THRESHOLD_MS = 1000` - Window for timestamp-based deduplication
- `IN_PROGRESS_MESSAGE_TIMEOUT_MS = 30000` - Timeout before in-progress stream is considered stale

---

## Layer 2: EventDisplay (components/events/EventDisplay.tsx)

**Purpose:** Limits displayed events to prevent performance issues with large event histories.

**Input:** `completedEvents` from useStreamingState

**Output:** `displayedEvents` (sliced array)

### What Gets Filtered

Events beyond the `maxEvents` window (default: 1000) are dropped:

```typescript
const displayedEvents = completedEvents.slice(-maxEvents)
```

**Important:** The slice takes the **last** N events, so older events are lost. This is an
intentional design decision to keep the UI responsive.

### Side Effects

This layer also builds two maps from the displayed events:

1. **`toolResults`**: Maps tool_use IDs to their results (for inline result display)
2. **`hasStructuredLifecycleEvents`**: Boolean flag for lifecycle event rendering decisions

---

## Layer 3: EventStreamEventItem (components/events/EventStreamEventItem.tsx)

**Purpose:** Routes events to appropriate renderer components based on event type.

**Input:** Individual `ChatEvent` objects

**Output:** React element or `null` (filtered)

### Event Type Routing

| Event Type           | Action       | Renderer                                       |
| -------------------- | ------------ | ---------------------------------------------- |
| User message         | Render       | `<UserMessage />`                              |
| Ralph task started   | Render       | `<TaskLifecycleEvent />`                       |
| Ralph task completed | Render       | `<TaskLifecycleEvent />`                       |
| Assistant message    | Render       | Content blocks via `renderEventContentBlock()` |
| Error/server_error   | Render       | `<ErrorEvent />`                               |
| **Tool result**      | **Filtered** | `return null`                                  |
| **stream_event**     | **Filtered** | `return null`                                  |
| **system**           | **Filtered** | `return null`                                  |
| Unknown types        | **Filtered** | `return null`                                  |

### Why These Are Filtered

- **tool_result**: Results are shown inline within their parent `tool_use` blocks (via the
  `toolResults` map), not as separate events
- **stream_event**: Already processed by useStreamingState into synthesized assistant messages
- **system**: Internal events not meant for user display

### Filtering Logic

```typescript
if (isToolResultEvent(event)) return null
if (event.type === "stream_event") return null
if (event.type === "system") return null
return null // Default for unrecognized types
```

---

## Layer 4: renderEventContentBlock (lib/renderEventContentBlock.tsx)

**Purpose:** Renders individual content blocks from assistant messages.

**Input:** `AssistantContentBlock` objects from assistant message content arrays

**Output:** React element or `null` (filtered)

### Content Block Routing

| Block Type                                  | Action       | Renderer                                                                    |
| ------------------------------------------- | ------------ | --------------------------------------------------------------------------- |
| thinking                                    | Render       | `<ThinkingBlock />`                                                         |
| text                                        | Render       | `<AssistantText />` (or `<TaskLifecycleEvent />` if it parses as lifecycle) |
| tool_use                                    | Render       | `<ToolUseCard />`                                                           |
| **Lifecycle text (when structured exists)** | **Filtered** | `return null`                                                               |
| Unknown types                               | **Filtered** | `return null`                                                               |

### Lifecycle Event Deduplication

Text blocks that parse as task lifecycle events (e.g., `<start_task>r-abc123</start_task>`)
are handled specially:

- If `hasStructuredLifecycleEvents` is true (meaning proper lifecycle events exist in the
  stream), the text-based lifecycle markers are filtered to avoid duplication
- If no structured lifecycle events exist, the text-based markers are rendered as
  `<TaskLifecycleEvent />` components

```typescript
if (block.type === "text") {
  const lifecycleEvent = parseTaskLifecycleEvent(block.text, timestamp)
  if (lifecycleEvent) {
    if (options?.hasStructuredLifecycleEvents) {
      return null // Already have structured events, skip text-based
    }
    return <TaskLifecycleEvent event={lifecycleEvent} />
  }
  return <AssistantText event={textEvent} />
}
```

---

## Summary of Filtered Events

| Layer                   | What's Filtered                               | Why                                    |
| ----------------------- | --------------------------------------------- | -------------------------------------- |
| useStreamingState       | Duplicate assistant events                    | Already synthesized from stream_events |
| EventDisplay            | Events beyond maxEvents window                | Performance (keeps last 1000)          |
| EventStreamEventItem    | tool_result, stream_event, system, unknown    | Rendered elsewhere or internal         |
| renderEventContentBlock | Duplicate lifecycle text, unknown block types | Avoid duplication, unsupported         |

---

## Debugging Event Filtering

### Debug Mode

The fastest way to debug event filtering is to enable the built-in debug mode:

```javascript
// In browser console:
localStorage.setItem("ralph-filter-debug", "true")
// Reload the page

// To disable:
localStorage.removeItem("ralph-filter-debug")
```

When enabled, every filter decision is logged to the console:

```
[L3] ✓ RENDER: assistant @ 1706500000000
[L3] ✗ FILTER: stream_event @ 1706500000001 - stream_event_processed_by_streaming
[L4] ✓ RENDER: block[0] type=text
[L4] ✗ FILTER: block[1] type=text - lifecycle_text_has_structured_event
```

### Programmatic Debugging

Import debugging utilities from EventFilterPipeline:

```typescript
import {
  debugFilterPipeline,
  getFilterStats,
  isFilterDebugEnabled,
} from "@/lib/EventFilterPipeline"

// Log all filter decisions for an array of events
debugFilterPipeline(events)

// Get statistics about what was filtered
const stats = getFilterStats(events)
// { rendered: 45, tool_result_rendered_inline: 12, stream_event_processed_by_streaming: 100 }
```

### Manual Investigation Steps

To debug why a specific event isn't showing:

1. **Check the raw events**: Are they present in the WebSocket stream?
2. **Check useStreamingState output**: Is the event in `completedEvents`?
3. **Check EventDisplay**: Is the event within the `maxEvents` window?
4. **Check EventStreamEventItem**: Does the event type return `null`?
5. **Check renderEventContentBlock**: For assistant messages, do all content blocks render?

### Adding Custom Logging

For more specific debugging, add logging at each layer:

```typescript
// In useStreamingState
console.log("[L1] Input:", events.length, "Output:", completedEvents.length)

// In EventDisplay
console.log("[L2] After slice:", displayedEvents.length)

// In EventStreamEventItem
console.log("[L3] Event type:", event.type, "Rendering:", result !== null)

// In renderEventContentBlock
console.log("[L4] Block type:", block.type, "Rendering:", result !== null)
```

---

## Related Files

- `ui/src/hooks/useStreamingState.ts` - Layer 1 implementation
- `ui/src/components/events/EventDisplay.tsx` - Layer 2 implementation
- `ui/src/components/events/EventStreamEventItem.tsx` - Layer 3 implementation
- `ui/src/lib/renderEventContentBlock.tsx` - Layer 4 implementation
- `ui/src/lib/parseTaskLifecycleEvent.ts` - Lifecycle text parsing
- `ui/src/lib/isToolResultEvent.ts` - Tool result type guard
- `ui/src/lib/isAssistantMessage.ts` - Assistant message type guard

---

## Future Improvements

See related issues for planned improvements:

- **r-tufi7.49.4**: Replace implicit null returns with explicit filter predicates
