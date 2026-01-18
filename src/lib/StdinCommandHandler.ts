import { createDebugLogger } from "./debug.js"
import { MessageQueue, createUserMessage } from "./MessageQueue.js"
import { createInterface } from "readline"

const log = createDebugLogger("stdin-command")

/**
 * Stdin command types:
 * - {"type": "message", "text": "..."} - Send a message to Claude
 * - {"type": "stop"} - Request graceful stop after current iteration
 */
export type StdinCommand = { type: "message"; text: string } | { type: "stop" }

/**
 * Parse a JSON string into a StdinCommand.
 * Returns null if parsing fails or the command is invalid.
 */
export const parseStdinCommand = (line: string): StdinCommand | null => {
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

    log(`Unknown command type: ${parsed.type}`)
    return null
  } catch (err) {
    log(`Failed to parse command: ${err instanceof Error ? err.message : String(err)}`)
    return null
  }
}

export type StdinCommandHandlerOptions = {
  messageQueue: MessageQueue | null
  onStop: () => void
  onMessage?: (text: string) => void
}

/**
 * Creates a stdin command handler that reads JSON commands from stdin.
 * Returns a cleanup function to stop reading.
 *
 * Commands:
 * - {"type": "message", "text": "..."} - Send a message to Claude
 * - {"type": "stop"} - Request graceful stop after current iteration
 */
export const createStdinCommandHandler = (
  getOptions: () => StdinCommandHandlerOptions,
): (() => void) => {
  // Don't set up stdin handler if stdin is a TTY (interactive mode handles input differently)
  // This handler is for piped input in JSON mode
  if (process.stdin.isTTY) {
    log(`stdin is TTY - skipping stdin command handler`)
    return () => {}
  }

  log(`Setting up stdin command handler`)

  const rl = createInterface({
    input: process.stdin,
    terminal: false,
  })

  const lineHandler = (line: string) => {
    const command = parseStdinCommand(line)
    if (!command) return

    const options = getOptions()
    log(`Received command: ${command.type}`)

    if (command.type === "message") {
      if (options.messageQueue) {
        const userMessage = createUserMessage(command.text)
        options.messageQueue.push(userMessage)
        log(`Pushed message to queue: ${command.text.slice(0, 50)}...`)
        options.onMessage?.(command.text)
      } else {
        log(`Cannot send message - no active message queue`)
      }
    } else if (command.type === "stop") {
      log(`Stop command received`)
      options.onStop()
    }
  }

  rl.on("line", lineHandler)

  return () => {
    log(`Cleaning up stdin command handler`)
    rl.off("line", lineHandler)
    rl.close()
  }
}
