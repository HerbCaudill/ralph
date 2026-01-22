import { AgentAdapter, type AgentInfo } from "./AgentAdapter.js"
import { ClaudeAdapter, type ClaudeAdapterOptions } from "./ClaudeAdapter.js"
import { CodexAdapter, type CodexAdapterOptions } from "./CodexAdapter.js"

/**
 * Map of registered adapters.
 */
const adapters = new Map<string, AdapterRegistration>()

/**
 * Register an adapter type. Throws an error if an adapter with the same ID is already registered.
 */
export function registerAdapter<T extends AgentAdapter>(
  /**
   * The adapter registration info
   */
  registration: AdapterRegistration<T>,
): void {
  if (adapters.has(registration.id)) {
    throw new Error(`Adapter with id "${registration.id}" is already registered`)
  }
  adapters.set(registration.id, registration as AdapterRegistration)
}

/**
 * Unregister an adapter type. Returns true if the adapter was unregistered, false if it wasn't registered.
 */
export function unregisterAdapter(
  /** The adapter ID to unregister */
  id: string,
): boolean {
  return adapters.delete(id)
}

/**
 * Get a list of all registered adapter IDs.
 */
export function getRegisteredAdapters(): string[] {
  return Array.from(adapters.keys())
}

/**
 * Check if an adapter type is registered.
 */
export function isAdapterRegistered(
  /** The adapter ID to check */
  id: string,
): boolean {
  return adapters.has(id)
}

/**
 * Get registration info for an adapter. Returns undefined if not registered.
 */
export function getAdapterRegistration(
  /** The adapter ID */
  id: string,
): AdapterRegistration | undefined {
  return adapters.get(id)
}

/**
 * Create an adapter instance by ID. Throws an error if the adapter ID is not registered.
 */
export function createAdapter<T extends AgentAdapter = AgentAdapter>(
  /** The adapter ID (e.g., "claude", "codex") */
  id: string,
  /** Options to pass to the adapter constructor */
  options?: unknown,
): T {
  const registration = adapters.get(id)
  if (!registration) {
    const available = getRegisteredAdapters().join(", ")
    throw new Error(
      `Unknown adapter "${id}". Available adapters: ${available || "none (no adapters registered)"}`,
    )
  }
  return registration.factory(options) as T
}

/**
 * Check if a specific adapter is available (installed and working).
 * Creates a temporary adapter instance and calls its isAvailable() method.
 * Throws an error if the adapter ID is not registered.
 */
export async function isAdapterAvailable(
  /** The adapter ID to check */
  id: string,
): Promise<boolean> {
  const adapter = createAdapter(id)
  return adapter.isAvailable()
}

/**
 * Get availability information for all registered adapters.
 * Useful for displaying a list of available agents to the user.
 */
export async function getAvailableAdapters(): Promise<AdapterAvailability[]> {
  const results: AdapterAvailability[] = []

  for (const [id, registration] of adapters) {
    try {
      const adapter = registration.factory()
      const available = await adapter.isAvailable()
      const info = adapter.getInfo()

      results.push({
        id,
        name: registration.name,
        description: registration.description,
        available,
        info,
      })
    } catch {
      // If we can't create the adapter, it's not available
      results.push({
        id,
        name: registration.name,
        description: registration.description,
        available: false,
      })
    }
  }

  return results
}

/**
 * Get the first available adapter. Useful for auto-selecting an agent when the user hasn't specified one.
 */
export async function getFirstAvailableAdapter(
  /** Optional array of adapter IDs to check in order of preference */
  preferredOrder?: string[],
): Promise<string | undefined> {
  const idsToCheck = preferredOrder ?? getRegisteredAdapters()

  for (const id of idsToCheck) {
    if (!isAdapterRegistered(id)) {
      continue
    }

    try {
      const available = await isAdapterAvailable(id)
      if (available) {
        return id
      }
    } catch {
      // Continue to next adapter
    }
  }

  return undefined
}

/**
 * Register the built-in adapters.
 * Called automatically when this module is imported, but can be called again after clearRegistry() if needed.
 */
export function registerDefaultAdapters(): void {
  // Register Claude adapter
  if (!adapters.has("claude")) {
    registerAdapter({
      id: "claude",
      name: "Claude",
      description: "Anthropic Claude via SDK",
      factory: options => new ClaudeAdapter(options as ClaudeAdapterOptions | undefined),
    })
  }

  // Register Codex adapter
  if (!adapters.has("codex")) {
    registerAdapter({
      id: "codex",
      name: "Codex",
      description: "OpenAI Codex via SDK",
      factory: options => new CodexAdapter(options as CodexAdapterOptions | undefined),
    })
  }
}

/**
 * Clear all registered adapters. Primarily useful for testing.
 */
export function clearRegistry(): void {
  adapters.clear()
}

registerDefaultAdapters()

/**
 * A factory function that creates an adapter instance.
 */
export type AdapterFactory<T extends AgentAdapter = AgentAdapter> = (options?: unknown) => T

/**
 * Registration entry for an adapter.
 */
export interface AdapterRegistration<T extends AgentAdapter = AgentAdapter> {
  /** Unique identifier for this adapter type */
  id: string
  /** Human-readable name */
  name: string
  /** Description of the adapter */
  description?: string
  /** Factory function to create adapter instances */
  factory: AdapterFactory<T>
}

/**
 * Information about an adapter including its availability status.
 */
export interface AdapterAvailability {
  /** Adapter ID */
  id: string
  /** Human-readable name */
  name: string
  /** Description */
  description?: string
  /** Whether the adapter is available (CLI installed, etc.) */
  available: boolean
  /** Full adapter info if a temporary instance could be created */
  info?: AgentInfo
}
