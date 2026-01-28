/**
 * EventFilterPipeline - Centralized event filtering logic for the Ralph UI.
 *
 * This module consolidates all event filtering decisions that were previously
 * scattered across useStreamingState, EventDisplay, EventStreamEventItem, and
 * renderEventContentBlock.
 *
 * ## Design Goals
 * - Make all filtering decisions explicit and documented
 * - Provide a single source of truth for what events are visible
 * - Enable easier debugging of why events aren't showing
 * - Support future debug mode to show filtered events
 *
 * ## Usage
 * ```ts
 * const { shouldRender, reason } = eventFilter.shouldRenderEvent(event, context)
 * if (!shouldRender) {
 *   console.log(`Event filtered: ${reason}`)
 * }
 * ```
 *
 * See EVENT_FILTERING_PIPELINE.md for detailed documentation.
 */

import type { ChatEvent, AssistantContentBlock } from "@/types"

/**
 * Reasons why an event might be filtered out.
 * These are explicit strings to aid debugging.
 */
export type FilterReason =
  // Layer 1: Streaming deduplication
  | "duplicate_assistant_from_streaming"
  // Layer 2: Window slicing (handled externally by slice, but tracked here)
  | "outside_event_window"
  // Layer 3: Event type routing
  | "tool_result_rendered_inline"
  | "stream_event_processed_by_streaming"
  | "system_event_internal"
  | "unrecognized_event_type"
  // Layer 4: Content block filtering
  | "lifecycle_text_has_structured_event"
  | "unrecognized_content_block_type"
  | "empty_assistant_content"

/**
 * Result of a filter decision.
 */
export interface FilterResult {
  /** Whether the event should be rendered */
  shouldRender: boolean
  /** Why the event was filtered (only set when shouldRender is false) */
  reason?: FilterReason
}

/**
 * Context needed for filtering decisions.
 */
export interface FilterContext {
  /** Whether structured lifecycle events exist in the event stream */
  hasStructuredLifecycleEvents?: boolean
}

// =============================================================================
// Layer 3: Event Type Filters
// These determine which event types should be rendered vs filtered
// =============================================================================

/**
 * Event types that have dedicated renderers and should be rendered.
 */
const RENDERABLE_EVENT_TYPES = new Set<string>([
  "user_message",
  "ralph_task_started",
  "ralph_task_completed",
  "assistant",
  "error",
  "server_error",
])

/**
 * Check if an event should be filtered based on its type.
 * This corresponds to Layer 3 of the filtering pipeline.
 */
export function shouldFilterEventByType(event: ChatEvent): FilterResult {
  const { type } = event

  // Tool result events (type="user" with tool_use_result) are filtered
  // because results are shown inline in the tool_use card
  if (type === "user" && typeof (event as Record<string, unknown>).tool_use_result !== "undefined") {
    return { shouldRender: false, reason: "tool_result_rendered_inline" }
  }

  // Stream events are already processed by useStreamingState
  if (type === "stream_event") {
    return { shouldRender: false, reason: "stream_event_processed_by_streaming" }
  }

  // System events are internal
  if (type === "system") {
    return { shouldRender: false, reason: "system_event_internal" }
  }

  // Check if it's a recognized renderable type
  if (RENDERABLE_EVENT_TYPES.has(type)) {
    return { shouldRender: true }
  }

  // Unrecognized types are filtered
  return { shouldRender: false, reason: "unrecognized_event_type" }
}

// =============================================================================
// Layer 4: Content Block Filters
// These determine which content blocks within assistant messages should render
// =============================================================================

/**
 * Content block types that have dedicated renderers.
 */
const RENDERABLE_BLOCK_TYPES = new Set<string>(["text", "thinking", "tool_use"])

/**
 * Check if a content block should be filtered.
 * This corresponds to Layer 4 of the filtering pipeline.
 *
 * @param block - The content block to check
 * @param isLifecycleText - Whether this text block parses as a lifecycle event
 * @param context - Additional context for filtering decisions
 */
export function shouldFilterContentBlock(
  block: AssistantContentBlock,
  isLifecycleText: boolean,
  context: FilterContext,
): FilterResult {
  // Lifecycle text blocks are filtered when structured events exist
  // to avoid duplicate lifecycle displays
  if (block.type === "text" && isLifecycleText && context.hasStructuredLifecycleEvents) {
    return { shouldRender: false, reason: "lifecycle_text_has_structured_event" }
  }

  // Check if it's a recognized renderable type
  if (RENDERABLE_BLOCK_TYPES.has(block.type)) {
    return { shouldRender: true }
  }

  // Unrecognized block types are filtered
  return { shouldRender: false, reason: "unrecognized_content_block_type" }
}

// =============================================================================
// Aggregate Filter Functions
// =============================================================================

/**
 * Check if an assistant event has any renderable content.
 * Returns false if all content blocks would be filtered.
 */
export function hasRenderableContent(
  content: AssistantContentBlock[] | undefined,
  context: FilterContext,
  parseLifecycle: (text: string) => boolean,
): boolean {
  if (!content || content.length === 0) {
    return false
  }

  return content.some(block => {
    const isLifecycleText = block.type === "text" && parseLifecycle(block.text)
    const result = shouldFilterContentBlock(block, isLifecycleText, context)
    return result.shouldRender
  })
}

/**
 * Get filter statistics for debugging.
 * Returns counts of events filtered at each layer.
 */
export function getFilterStats(events: ChatEvent[]): Record<FilterReason | "rendered", number> {
  const stats: Record<string, number> = { rendered: 0 }

  for (const event of events) {
    const result = shouldFilterEventByType(event)
    if (result.shouldRender) {
      stats.rendered++
    } else if (result.reason) {
      stats[result.reason] = (stats[result.reason] || 0) + 1
    }
  }

  return stats as Record<FilterReason | "rendered", number>
}

/**
 * Debug helper: Log why each event was filtered or rendered.
 * Only use in development/debugging.
 */
export function debugFilterPipeline(events: ChatEvent[]): void {
  console.group("[EventFilterPipeline] Filtering", events.length, "events")

  for (const event of events) {
    const result = shouldFilterEventByType(event)
    if (result.shouldRender) {
      console.log(`✓ RENDER: ${event.type} @ ${event.timestamp}`)
    } else {
      console.log(`✗ FILTER: ${event.type} @ ${event.timestamp} - ${result.reason}`)
    }
  }

  const stats = getFilterStats(events)
  console.log("Stats:", stats)
  console.groupEnd()
}
