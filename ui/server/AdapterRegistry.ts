/**
 * AdapterRegistry - Registry and factory for agent adapters
 *
 * Provides a centralized way to register, discover, and instantiate agent adapters.
 * Each adapter type is registered with its constructor and can be queried for availability.
 */

import { AgentAdapter, type AgentInfo } from "./AgentAdapter.js"
import { ClaudeAdapter, type ClaudeAdapterOptions } from "./ClaudeAdapter.js"

// =============================================================================
// Types
// =============================================================================

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

// =============================================================================
// Registry Implementation
// =============================================================================

/**
 * Map of registered adapters.
 */
const adapters = new Map<string, AdapterRegistration>()

/**
 * Register an adapter type.
 *
 * @param registration - The adapter registration info
 * @throws Error if an adapter with the same ID is already registered
 *
 * @example
 * ```ts
 * registerAdapter({
 *   id: "claude",
 *   name: "Claude",
 *   description: "Anthropic Claude via CLI",
 *   factory: (options) => new ClaudeAdapter(options),
 * })
 * ```
 */
export function registerAdapter<T extends AgentAdapter>(
  registration: AdapterRegistration<T>,
): void {
  if (adapters.has(registration.id)) {
    throw new Error(`Adapter with id "${registration.id}" is already registered`)
  }
  adapters.set(registration.id, registration as AdapterRegistration)
}

/**
 * Unregister an adapter type.
 *
 * @param id - The adapter ID to unregister
 * @returns true if the adapter was unregistered, false if it wasn't registered
 */
export function unregisterAdapter(id: string): boolean {
  return adapters.delete(id)
}

/**
 * Get a list of all registered adapter IDs.
 *
 * @returns Array of registered adapter IDs
 */
export function getRegisteredAdapters(): string[] {
  return Array.from(adapters.keys())
}

/**
 * Check if an adapter type is registered.
 *
 * @param id - The adapter ID to check
 * @returns true if the adapter is registered
 */
export function isAdapterRegistered(id: string): boolean {
  return adapters.has(id)
}

/**
 * Get registration info for an adapter.
 *
 * @param id - The adapter ID
 * @returns The registration info, or undefined if not registered
 */
export function getAdapterRegistration(id: string): AdapterRegistration | undefined {
  return adapters.get(id)
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create an adapter instance by ID.
 *
 * @param id - The adapter ID (e.g., "claude", "codex")
 * @param options - Options to pass to the adapter constructor
 * @returns A new adapter instance
 * @throws Error if the adapter ID is not registered
 *
 * @example
 * ```ts
 * const adapter = createAdapter("claude", { command: "custom-claude" })
 * adapter.on("event", handleEvent)
 * await adapter.start({ cwd: "/project" })
 * ```
 */
export function createAdapter<T extends AgentAdapter = AgentAdapter>(
  id: string,
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

// =============================================================================
// Availability Checking
// =============================================================================

/**
 * Check if a specific adapter is available (installed and working).
 *
 * Creates a temporary adapter instance and calls its isAvailable() method.
 *
 * @param id - The adapter ID to check
 * @returns Promise that resolves to true if available, false otherwise
 * @throws Error if the adapter ID is not registered
 */
export async function isAdapterAvailable(id: string): Promise<boolean> {
  const adapter = createAdapter(id)
  return adapter.isAvailable()
}

/**
 * Get availability information for all registered adapters.
 *
 * This is useful for displaying a list of available agents to the user.
 *
 * @returns Promise that resolves to an array of availability info for each adapter
 *
 * @example
 * ```ts
 * const available = await getAvailableAdapters()
 * for (const adapter of available) {
 *   console.log(`${adapter.name}: ${adapter.available ? "✓" : "✗"}`)
 * }
 * ```
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
 * Get the first available adapter.
 *
 * Useful for auto-selecting an agent when the user hasn't specified one.
 *
 * @param preferredOrder - Optional array of adapter IDs to check in order of preference
 * @returns Promise that resolves to the ID of the first available adapter, or undefined
 *
 * @example
 * ```ts
 * // Use default order (registration order)
 * const adapterId = await getFirstAvailableAdapter()
 *
 * // Prefer codex over claude
 * const adapterId = await getFirstAvailableAdapter(["codex", "claude"])
 * ```
 */
export async function getFirstAvailableAdapter(
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

// =============================================================================
// Default Adapter Registration
// =============================================================================

/**
 * Register the built-in adapters.
 *
 * Called automatically when this module is imported, but can be called
 * again after clearRegistry() if needed.
 */
export function registerDefaultAdapters(): void {
  // Register Claude adapter
  if (!adapters.has("claude")) {
    registerAdapter({
      id: "claude",
      name: "Claude",
      description: "Anthropic Claude via CLI",
      factory: options => new ClaudeAdapter(options as ClaudeAdapterOptions | undefined),
    })
  }

  // Future: Register Codex adapter when available
  // if (!adapters.has("codex")) {
  //   registerAdapter({
  //     id: "codex",
  //     name: "Codex",
  //     description: "OpenAI Codex via CLI",
  //     factory: (options?: CodexAdapterOptions) => new CodexAdapter(options),
  //   })
  // }
}

/**
 * Clear all registered adapters.
 *
 * Primarily useful for testing.
 */
export function clearRegistry(): void {
  adapters.clear()
}

// Register default adapters on module load
registerDefaultAdapters()
