import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { createRalphEventRenderers } from "../createRalphEventRenderers"
import type { TaskLifecycleChatEvent, PromiseCompleteChatEvent } from "@herbcaudill/agent-view"

describe("createRalphEventRenderers", () => {
  it("returns an object with task_lifecycle and promise_complete renderers", () => {
    const renderers = createRalphEventRenderers()
    expect(renderers).toHaveProperty("task_lifecycle")
    expect(renderers).toHaveProperty("promise_complete")
  })

  describe("task_lifecycle renderer", () => {
    it("renders a starting task lifecycle event", () => {
      const renderers = createRalphEventRenderers()
      const event: TaskLifecycleChatEvent = {
        type: "task_lifecycle",
        timestamp: Date.now(),
        action: "starting",
        taskId: "r-test123",
      }
      render(<>{renderers.task_lifecycle(event)}</>)
      expect(screen.getByText("Starting")).toBeInTheDocument()
      expect(screen.getByText("r-test123")).toBeInTheDocument()
    })

    it("renders a completed task lifecycle event", () => {
      const renderers = createRalphEventRenderers()
      const event: TaskLifecycleChatEvent = {
        type: "task_lifecycle",
        timestamp: Date.now(),
        action: "completed",
        taskId: "r-done456",
      }
      render(<>{renderers.task_lifecycle(event)}</>)
      expect(screen.getByText("Completed")).toBeInTheDocument()
      expect(screen.getByText("r-done456")).toBeInTheDocument()
    })
  })

  describe("promise_complete renderer", () => {
    it("renders a promise complete event", () => {
      const renderers = createRalphEventRenderers()
      const event: PromiseCompleteChatEvent = {
        type: "promise_complete",
        timestamp: Date.now(),
      }
      render(<>{renderers.promise_complete(event)}</>)
      expect(screen.getByText("Session complete")).toBeInTheDocument()
      expect(screen.getByText("All tasks finished — no remaining work")).toBeInTheDocument()
    })
  })
})
