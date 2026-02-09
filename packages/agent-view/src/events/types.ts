/**
 * TypeScript types inferred from the canonical event schema.
 *
 * These types are derived from the Effect Schema definitions and should be
 * used throughout the codebase instead of manually defined interfaces.
 */
import { Schema as S } from "effect"
import {
  BaseEvent,
  CanonicalEvent,
  ErrorEvent,
  InterruptedEvent,
  MessageEvent,
  ResultEvent,
  StatusEvent,
  ThinkingEvent,
  ToolResultEvent,
  ToolUseEvent,
  UnknownEvent,
} from "./schema.js"

// Decoded types (what you work with in code)

/** Base event fields present on every canonical event. */
export type BaseEventType = S.Schema.Type<typeof BaseEvent>

/** A text message from the assistant. */
export type MessageEventType = S.Schema.Type<typeof MessageEvent>

/** Extended thinking content from the assistant. */
export type ThinkingEventType = S.Schema.Type<typeof ThinkingEvent>

/** A tool invocation by the assistant. */
export type ToolUseEventType = S.Schema.Type<typeof ToolUseEvent>

/** The result of a tool invocation. */
export type ToolResultEventType = S.Schema.Type<typeof ToolResultEvent>

/** Final result of an agent run. */
export type ResultEventType = S.Schema.Type<typeof ResultEvent>

/** An error from the agent. */
export type ErrorEventType = S.Schema.Type<typeof ErrorEvent>

/** Agent status changed. */
export type StatusEventType = S.Schema.Type<typeof StatusEvent>

/** Agent was interrupted by the user. */
export type InterruptedEventType = S.Schema.Type<typeof InterruptedEvent>

/** Catch-all for custom/unknown event types. */
export type UnknownEventType = S.Schema.Type<typeof UnknownEvent>

/** Union of all canonical event types. */
export type CanonicalEventType = S.Schema.Type<typeof CanonicalEvent>

// Encoded types (what comes over the wire — before defaults are applied)

/** Encoded (wire) shape for a canonical event. */
export type CanonicalEventEncoded = S.Schema.Encoded<typeof CanonicalEvent>

// Agent status literal type

/** Possible agent statuses. */
export type AgentStatus = "idle" | "starting" | "running" | "paused" | "stopping" | "stopped"
