import type { SDKUserMessage } from "@anthropic-ai/claude-agent-sdk"

/**
 * A message queue that can be used as an async iterable for the SDK's streamInput.
 * Allows pushing messages dynamically while iterating.
 */
export class MessageQueue implements AsyncIterable<SDKUserMessage> {
  private queue: SDKUserMessage[] = []
  private resolvers: Array<(result: IteratorResult<SDKUserMessage>) => void> = []
  private closed = false

  push(message: SDKUserMessage): void {
    if (this.closed) return

    if (this.resolvers.length > 0) {
      const resolve = this.resolvers.shift()!
      resolve({ value: message, done: false })
    } else {
      this.queue.push(message)
    }
  }

  close(): void {
    this.closed = true
    // Resolve any pending iterators
    for (const resolve of this.resolvers) {
      resolve({ value: undefined as unknown as SDKUserMessage, done: true })
    }
    this.resolvers = []
  }

  [Symbol.asyncIterator](): AsyncIterator<SDKUserMessage> {
    return {
      next: (): Promise<IteratorResult<SDKUserMessage>> => {
        if (this.queue.length > 0) {
          return Promise.resolve({ value: this.queue.shift()!, done: false })
        }
        if (this.closed) {
          return Promise.resolve({ value: undefined as unknown as SDKUserMessage, done: true })
        }
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
