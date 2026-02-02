/**
 * Re-export AdapterRegistry functions and types from @herbcaudill/ralph-server.
 * These were extracted to agent-server as the canonical location.
 */
export {
  registerAdapter,
  unregisterAdapter,
  getRegisteredAdapters,
  isAdapterRegistered,
  getAdapterRegistration,
  createAdapter,
  isAdapterAvailable,
  getAvailableAdapters,
  getFirstAvailableAdapter,
  registerDefaultAdapters,
  clearRegistry,
  type AdapterFactory,
  type AdapterRegistration,
  type AdapterAvailability,
} from "@herbcaudill/ralph-server"
