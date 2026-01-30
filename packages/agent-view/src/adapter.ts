import type { ChatEvent } from "./types"

/**
 * Convert a native agent event into zero or more ChatEvents.
 *
 * This is the core translation function that adapters must implement.
 * A single native event may produce zero ChatEvents (if filtered),
 * one ChatEvent (typical), or multiple ChatEvents (e.g., a message
 * containing both text and tool use).
 */
export type ConvertEvent = (
  /** The native event from the agent SDK (e.g., Claude stream JSON, Codex event). */
  nativeEvent: unknown,
) => ChatEvent[]

/**
 * Convert a batch of native agent events into ChatEvents.
 *
 * Default behavior is to flatMap over `convertEvent`, but adapters
 * may override this for optimizations like deduplication or reordering.
 */
export type ConvertEvents = (
  /** Array of native events from the agent SDK. */
  nativeEvents: unknown[],
) => ChatEvent[]

/** Metadata about an agent implementation. */
export interface AgentMeta {
  /** Machine-readable identifier (e.g., "claude", "codex"). */
  name: string
  /** Human-readable display name (e.g., "Claude", "Codex"). */
  displayName: string
  /** Version of the agent or adapter. */
  version?: string
}

/**
 * Interface that agent adapters must implement to translate native
 * agent events into the ChatEvent format used by agent-view components.
 *
 * This is a pure event-translation interface -- it has no opinions about
 * process management, networking, or session lifecycle. Adapters that
 * need those capabilities should compose this interface with their own
 * runtime layer.
 */
export interface AgentAdapter {
  /** Agent metadata. */
  meta: AgentMeta

  /** Convert a single native event into zero or more ChatEvents. */
  convertEvent: ConvertEvent

  /** Convert a batch of native events into ChatEvents. */
  convertEvents: ConvertEvents
}

/**
 * Create a batch converter from a single-event converter.
 *
 * Utility for adapter implementations that only need to define
 * `convertEvent` and want the default flatMap behavior for batches.
 */
export const createBatchConverter =
  (
    /** The single-event converter function. */
    convertEvent: ConvertEvent,
  ): ConvertEvents =>
  (nativeEvents: unknown[]): ChatEvent[] =>
    nativeEvents.flatMap(convertEvent)
