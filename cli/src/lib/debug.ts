type DebugNamespace = "messagequeue" | "session" | "sdk" | "stdin-command" | "worktree"

/**
 * Check if debug logging is enabled for the given namespace.
 * Controlled by RALPH_DEBUG environment variable:
 * - RALPH_DEBUG=1 or RALPH_DEBUG=true or RALPH_DEBUG=all - enable all logging
 * - RALPH_DEBUG=messagequeue - enable only that namespace
 * - RALPH_DEBUG=messagequeue,session - enable multiple namespaces
 */
const isDebugEnabled = (
  /** The debug namespace to check, or undefined to check global debug setting */
  namespace?: DebugNamespace,
): boolean => {
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

/**  Log a debug message if debugging is enabled for the given namespace. */
export const debug = (
  /** The debug namespace for this message */
  namespace: DebugNamespace,
  /** The message to log */
  message: string,
  /** Additional arguments to log after the message */
  ...args: unknown[]
): void => {
  if (isDebugEnabled(namespace)) {
    const timestamp = new Date().toISOString()
    const prefix = `[${timestamp}] [RALPH:${namespace.toUpperCase()}]`
    // eslint-disable-next-line no-console
    console.error(prefix, message, ...args)
  }
}

/**  Create a namespaced debug logger that captures the namespace for all logs. */
export const createDebugLogger = (
  /** The debug namespace to use for all logged messages */
  namespace: DebugNamespace,
) => {
  return (
    /** The message to log */
    message: string,
    /** Additional arguments to log after the message */
    ...args: unknown[]
  ) => debug(namespace, message, ...args)
}
