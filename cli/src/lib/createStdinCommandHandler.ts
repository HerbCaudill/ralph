import { createDebugLogger } from "./debug.js"
import { MessageQueue, createUserMessage } from "./MessageQueue.js"
import { parseStdinCommand } from "./parseStdinCommand.js"
import { createInterface } from "readline"

const log = createDebugLogger("stdin-command")

/**
 * Creates a stdin command handler that reads JSON commands from stdin.
 * Returns a cleanup function to stop reading.
 *
 * Commands:
 * - {"type": "message", "text": "..."} - Send a message to Claude
 * - {"type": "stop"} - Request graceful stop after current session
 * - {"type": "pause"} - Pause after current session completes
 * - {"type": "resume"} - Resume from paused state
 */
export const createStdinCommandHandler = (
  /** Getter for handler options; called when a command is received */
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
    } else if (command.type === "pause") {
      log(`Pause command received`)
      options.onPause?.()
    } else if (command.type === "resume") {
      log(`Resume command received`)
      options.onResume?.()
    }
  }

  rl.on("line", lineHandler)

  return () => {
    log(`Cleaning up stdin command handler`)
    rl.off("line", lineHandler)
    rl.close()
  }
}

/**  Options for the stdin command handler */
export type StdinCommandHandlerOptions = {
  /** The message queue to push user messages to, or null if not active */
  messageQueue: MessageQueue | null
  /** Callback invoked when a stop command is received */
  onStop: () => void
  /** Optional callback invoked when a pause command is received */
  onPause?: () => void
  /** Optional callback invoked when a resume command is received */
  onResume?: () => void
  /** Optional callback invoked when a user message is processed */
  onMessage?: (text: string) => void
}
