import { describe, it, expect } from "vitest"
import { MessageQueue, createUserMessage } from "./MessageQueue.js"

describe("MessageQueue", () => {
  it("should yield messages that were pushed before iteration started", async () => {
    const queue = new MessageQueue()
    const msg1 = createUserMessage("hello")
    const msg2 = createUserMessage("world")

    queue.push(msg1)
    queue.push(msg2)
    queue.close()

    const messages = []
    for await (const msg of queue) {
      messages.push(msg)
    }

    expect(messages).toEqual([msg1, msg2])
  })

  it("should yield messages pushed during iteration", async () => {
    const queue = new MessageQueue()
    const msg1 = createUserMessage("first")
    const msg2 = createUserMessage("second")

    // Start iteration
    const iterator = queue[Symbol.asyncIterator]()

    // Push first message while waiting
    const promise1 = iterator.next()
    queue.push(msg1)

    const result1 = await promise1
    expect(result1.value).toEqual(msg1)
    expect(result1.done).toBe(false)

    // Push second message
    const promise2 = iterator.next()
    queue.push(msg2)

    const result2 = await promise2
    expect(result2.value).toEqual(msg2)
    expect(result2.done).toBe(false)

    // Close and verify done
    queue.close()
    const result3 = await iterator.next()
    expect(result3.done).toBe(true)
  })

  it("should not yield messages after close", async () => {
    const queue = new MessageQueue()
    const msg = createUserMessage("test")

    queue.push(msg)
    queue.close()

    // Pushing after close should be ignored
    queue.push(createUserMessage("ignored"))

    const messages = []
    for await (const m of queue) {
      messages.push(m)
    }

    expect(messages).toEqual([msg])
  })

  it("should resolve pending iterators when closed", async () => {
    const queue = new MessageQueue()

    // Start waiting for a message that will never come
    const iterator = queue[Symbol.asyncIterator]()
    const promise = iterator.next()

    // Close should resolve the pending promise
    queue.close()

    const result = await promise
    expect(result.done).toBe(true)
  })
})

describe("createUserMessage", () => {
  it("should create a valid SDK user message", () => {
    const message = createUserMessage("Hello Claude!")

    expect(message).toEqual({
      type: "user",
      session_id: "",
      message: {
        role: "user",
        content: [{ type: "text", text: "Hello Claude!" }],
      },
      parent_tool_use_id: null,
    })
  })
})

describe("MessageQueue hang scenarios", () => {
  /**
   * This test documents the hang behavior that can occur when:
   * 1. The SDK iterates the MessageQueue via streamInput()
   * 2. The MessageQueue is empty and not closed
   * 3. The SDK calls next() expecting more messages
   *
   * In this case, next() returns a Promise that never resolves
   * until close() is called. If close() is only called after the
   * SDK iteration completes, we have a deadlock.
   */
  it("should hang if next() is called on empty unclosed queue", async () => {
    const queue = new MessageQueue()
    const msg = createUserMessage("test")
    queue.push(msg)

    const iterator = queue[Symbol.asyncIterator]()

    // First next() returns the queued message
    const result1 = await iterator.next()
    expect(result1.done).toBe(false)
    expect(result1.value).toEqual(msg)

    // Second next() on empty queue - this will hang until close() is called
    // Use a timeout to demonstrate the hang behavior
    const nextPromise = iterator.next()
    let resolved = false
    nextPromise.then(() => {
      resolved = true
    })

    // Wait a bit - the promise should NOT resolve
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(resolved).toBe(false)

    // Now close the queue - this should resolve the pending promise
    queue.close()

    // Wait for the promise to resolve
    const result2 = await nextPromise
    expect(result2.done).toBe(true)
    expect(resolved).toBe(true)
  })

  it("should allow timeout-based iteration completion", async () => {
    const queue = new MessageQueue()
    const msg = createUserMessage("test")
    queue.push(msg)

    // Use Promise.race to implement timeout behavior
    const iterator = queue[Symbol.asyncIterator]()

    const result1 = await iterator.next()
    expect(result1.value).toEqual(msg)

    // Create a "timeout" mechanism
    const timeoutPromise = new Promise<IteratorResult<unknown>>(resolve =>
      setTimeout(() => resolve({ done: true, value: undefined }), 100),
    )

    // Race between next message and timeout
    const result = await Promise.race([iterator.next(), timeoutPromise])
    expect(result.done).toBe(true)

    // Clean up
    queue.close()
  })
})
