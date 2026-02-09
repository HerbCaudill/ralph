/**
 * Canonical event schema defined with Effect Schema.
 *
 * This is the single source of truth for event types used by agent-view.
 * All core event types are defined here; custom/unknown event types are
 * captured by UnknownEvent for extensibility via the plugin system.
 */
import { Schema as S } from "effect"

// Base event — every event has these fields, with auto-generated defaults

export const BaseEvent = S.Struct({
  id: S.optional(S.String).pipe(S.withDecodingDefault(() => crypto.randomUUID())),
  timestamp: S.optional(S.Number).pipe(S.withDecodingDefault(() => Date.now())),
  type: S.String,
})

// Core event types that agent-view renders natively

/** A text message from the assistant. */
export const MessageEvent = BaseEvent.pipe(
  S.extend(
    S.Struct({
      type: S.Literal("message"),
      content: S.String,
      isPartial: S.optional(S.Boolean),
    }),
  ),
)

/** Extended thinking content from the assistant. */
export const ThinkingEvent = BaseEvent.pipe(
  S.extend(
    S.Struct({
      type: S.Literal("thinking"),
      content: S.String,
      isPartial: S.optional(S.Boolean),
    }),
  ),
)

/** A tool invocation by the assistant. */
export const ToolUseEvent = BaseEvent.pipe(
  S.extend(
    S.Struct({
      type: S.Literal("tool_use"),
      toolUseId: S.String,
      tool: S.String,
      input: S.Record({ key: S.String, value: S.Unknown }),
    }),
  ),
)

/** The result of a tool invocation. */
export const ToolResultEvent = BaseEvent.pipe(
  S.extend(
    S.Struct({
      type: S.Literal("tool_result"),
      toolUseId: S.String,
      output: S.optional(S.String),
      error: S.optional(S.String),
      isError: S.Boolean,
    }),
  ),
)

/** Final result of an agent run. */
export const ResultEvent = BaseEvent.pipe(
  S.extend(
    S.Struct({
      type: S.Literal("result"),
      content: S.String,
      exitCode: S.optional(S.Number),
      usage: S.optional(
        S.Struct({
          inputTokens: S.optional(S.Number),
          outputTokens: S.optional(S.Number),
          totalTokens: S.optional(S.Number),
        }),
      ),
    }),
  ),
)

/** An error from the agent. */
export const ErrorEvent = BaseEvent.pipe(
  S.extend(
    S.Struct({
      type: S.Literal("error"),
      message: S.String,
      code: S.optional(S.String),
      fatal: S.Boolean,
    }),
  ),
)

/** Agent status changed. */
export const StatusEvent = BaseEvent.pipe(
  S.extend(
    S.Struct({
      type: S.Literal("status"),
      status: S.Literal("idle", "starting", "running", "paused", "stopping", "stopped"),
    }),
  ),
)

/** Agent was interrupted by the user. */
export const InterruptedEvent = BaseEvent.pipe(
  S.extend(
    S.Struct({
      type: S.Literal("interrupted"),
      message: S.optional(S.String),
    }),
  ),
)

// Catch-all for custom/unknown event types

/**
 * Catch-all for event types not in the core set.
 * Custom renderers can handle these via the plugin system.
 * Preserves all fields from the original event.
 */
export const UnknownEvent = S.Struct({
  id: S.optional(S.String).pipe(S.withDecodingDefault(() => crypto.randomUUID())),
  timestamp: S.optional(S.Number).pipe(S.withDecodingDefault(() => Date.now())),
  type: S.String,
}).pipe(S.extend(S.Record({ key: S.String, value: S.Unknown })))

// Union of all canonical event types

/**
 * Union of all known event types + catch-all for extensibility.
 *
 * When decoding, Effect Schema tries each member in order and uses the first
 * match. UnknownEvent is last so it only matches types not covered by the
 * core schemas.
 */
export const CanonicalEvent = S.Union(
  MessageEvent,
  ThinkingEvent,
  ToolUseEvent,
  ToolResultEvent,
  ResultEvent,
  ErrorEvent,
  StatusEvent,
  InterruptedEvent,
  UnknownEvent,
)
