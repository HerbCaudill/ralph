import { createDebugLogger } from "./debug.js"

const log = createDebugLogger("stdin-command")

/**
 * Stdin command types:
 * - {"type": "message", "text": "..."} - Send a message to Claude
 * - {"type": "stop"} - Request graceful stop after current session
 * - {"type": "pause"} - Pause after current session completes
 * - {"type": "resume"} - Resume from paused state
 */
export type StdinCommand =
  | { type: "message"; text: string }
  | { type: "stop" }
  | { type: "pause" }
  | { type: "resume" }

/**
 * Parse a JSON string into a StdinCommand.
 * Returns null if parsing fails or the command is invalid.
 */
export const parseStdinCommand = (
  /** The line to parse as JSON */
  line: string,
): StdinCommand | null => {
  const trimmed = line.trim()
  if (!trimmed) return null

  try {
    const parsed = JSON.parse(trimmed)

    if (typeof parsed !== "object" || parsed === null) {
      log(`Invalid command - not an object: ${trimmed}`)
      return null
    }

    if (parsed.type === "message") {
      if (typeof parsed.text !== "string") {
        log(`Invalid message command - missing or invalid text: ${trimmed}`)
        return null
      }
      return { type: "message", text: parsed.text }
    }

    if (parsed.type === "stop") {
      return { type: "stop" }
    }

    if (parsed.type === "pause") {
      return { type: "pause" }
    }

    if (parsed.type === "resume") {
      return { type: "resume" }
    }

    log(`Unknown command type: ${parsed.type}`)
    return null
  } catch (err) {
    log(`Failed to parse command: ${err instanceof Error ? err.message : String(err)}`)
    return null
  }
}
