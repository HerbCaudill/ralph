/**
 * Debug logging utility controlled by RALPH_DEBUG environment variable.
 *
 * Set RALPH_DEBUG=1 or RALPH_DEBUG=true to enable debug logging.
 * Set RALPH_DEBUG=messagequeue to enable only MessageQueue logging.
 * Set RALPH_DEBUG=all or RALPH_DEBUG=* to enable all debug logging.
 */

type DebugNamespace = "messagequeue" | "iteration" | "sdk" | "stdin-command" | "worktree"

const isDebugEnabled = (namespace?: DebugNamespace): boolean => {
  const debugEnv = process.env.RALPH_DEBUG

  if (!debugEnv) return false

  const value = debugEnv.toLowerCase()

  // Enable all debugging
  if (value === "1" || value === "true" || value === "all" || value === "*") {
    return true
  }

  // Enable specific namespace
  if (namespace && value === namespace.toLowerCase()) {
    return true
  }

  // Comma-separated list of namespaces
  if (namespace && value.includes(",")) {
    return value.split(",").some(ns => ns.trim().toLowerCase() === namespace.toLowerCase())
  }

  return false
}

/**
 * Log a debug message if debugging is enabled for the given namespace.
 */
export const debug = (namespace: DebugNamespace, message: string, ...args: unknown[]): void => {
  if (isDebugEnabled(namespace)) {
    const timestamp = new Date().toISOString()
    const prefix = `[${timestamp}] [RALPH:${namespace.toUpperCase()}]`
    // eslint-disable-next-line no-console
    console.error(prefix, message, ...args)
  }
}

/**
 * Create a namespaced debug logger.
 */
export const createDebugLogger = (namespace: DebugNamespace) => {
  return (message: string, ...args: unknown[]) => debug(namespace, message, ...args)
}
