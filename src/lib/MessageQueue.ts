import type { SDKUserMessage } from "@anthropic-ai/claude-agent-sdk"
import { createDebugLogger } from "./debug.js"

const log = createDebugLogger("messagequeue")

/**
 * A message queue that can be used as an async iterable for the SDK's streamInput.
 * Allows pushing messages dynamically while iterating.
 */
export class MessageQueue implements AsyncIterable<SDKUserMessage> {
  private queue: SDKUserMessage[] = []
  private resolvers: Array<(result: IteratorResult<SDKUserMessage>) => void> = []
  private closed = false
  private nextCallCount = 0

  push(message: SDKUserMessage): void {
    const messagePreview = this.getMessagePreview(message)
    log(`push() called with message: ${messagePreview}`)

    if (this.closed) {
      log(`push() ignored - queue is closed`)
      return
    }

    if (this.resolvers.length > 0) {
      const resolve = this.resolvers.shift()!
      log(`push() resolving pending next() call (${this.resolvers.length} resolvers remaining)`)
      resolve({ value: message, done: false })
    } else {
      this.queue.push(message)
      log(`push() added to queue (queue length: ${this.queue.length})`)
    }
  }

  close(): void {
    log(`close() called - resolving ${this.resolvers.length} pending resolvers`)
    this.closed = true
    // Resolve any pending iterators
    for (const resolve of this.resolvers) {
      log(`close() resolving pending resolver with done=true`)
      resolve({ value: undefined as unknown as SDKUserMessage, done: true })
    }
    this.resolvers = []
    log(`close() complete`)
  }

  private getMessagePreview(message: SDKUserMessage): string {
    const content = message.message?.content
    if (Array.isArray(content) && content.length > 0) {
      const firstBlock = content[0]
      if ("text" in firstBlock && typeof firstBlock.text === "string") {
        const text = firstBlock.text.slice(0, 50)
        return text.length < firstBlock.text.length ? `"${text}..."` : `"${text}"`
      }
    }
    return `[${message.type} message]`
  }

  [Symbol.asyncIterator](): AsyncIterator<SDKUserMessage> {
    return {
      next: (): Promise<IteratorResult<SDKUserMessage>> => {
        this.nextCallCount++
        const callId = this.nextCallCount

        if (this.queue.length > 0) {
          const message = this.queue.shift()!
          log(`next() #${callId}: returning queued message (${this.queue.length} remaining)`)
          return Promise.resolve({ value: message, done: false })
        }
        if (this.closed) {
          log(`next() #${callId}: queue closed, returning done=true`)
          return Promise.resolve({ value: undefined as unknown as SDKUserMessage, done: true })
        }
        log(
          `next() #${callId}: queue empty, creating pending resolver (${this.resolvers.length + 1} total)`,
        )
        return new Promise(resolve => {
          this.resolvers.push(resolve)
        })
      },
    }
  }
}

/**
 * Create an SDKUserMessage from text.
 */
export const createUserMessage = (text: string): SDKUserMessage => ({
  type: "user",
  session_id: "",
  message: {
    role: "user",
    content: [{ type: "text", text }],
  },
  parent_tool_use_id: null,
})
