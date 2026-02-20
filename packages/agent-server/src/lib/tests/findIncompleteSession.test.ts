import { describe, it, expect, beforeEach } from "vitest"
import { tmpdir } from "node:os"
import { mkdtempSync } from "node:fs"
import { join } from "node:path"
import { SessionPersister } from "@herbcaudill/ralph-shared/server"
import { findIncompleteSession, findAnyIncompleteSession } from "../findIncompleteSession.js"

describe("findIncompleteSession", () => {
  let storageDir: string
  let persister: SessionPersister

  beforeEach(() => {
    storageDir = mkdtempSync(join(tmpdir(), "find-incomplete-test-"))
    persister = new SessionPersister(storageDir)
  })

  it("returns null when no sessions exist", async () => {
    const result = await findIncompleteSession(persister, "r-abc123", "ralph")
    expect(result).toBeNull()
  })

  it("returns null when no sessions match the task ID", async () => {
    // Create a session for a different task
    await persister.appendEvent(
      "session-1",
      {
        type: "session_created",
        sessionId: "session-1",
        adapter: "claude",
        timestamp: Date.now(),
      },
      "ralph",
    )
    await persister.appendEvent(
      "session-1",
      {
        type: "assistant",
        message: {
          content: [{ type: "text", text: "<start_task>r-other</start_task>" }],
        },
        timestamp: Date.now(),
      },
      "ralph",
    )
    await persister.appendEvent(
      "session-1",
      {
        type: "assistant",
        message: {
          content: [{ type: "text", text: "<end_task>r-other</end_task>" }],
        },
        timestamp: Date.now(),
      },
      "ralph",
    )

    const result = await findIncompleteSession(persister, "r-abc123", "ralph")
    expect(result).toBeNull()
  })

  it("returns null when session is complete (has end_task)", async () => {
    // Create a complete session
    await persister.appendEvent(
      "complete-session",
      {
        type: "session_created",
        sessionId: "complete-session",
        adapter: "claude",
        timestamp: Date.now(),
      },
      "ralph",
    )
    await persister.appendEvent(
      "complete-session",
      {
        type: "assistant",
        message: {
          content: [{ type: "text", text: "<start_task>r-abc123</start_task>" }],
        },
        timestamp: Date.now(),
      },
      "ralph",
    )
    await persister.appendEvent(
      "complete-session",
      {
        type: "assistant",
        message: {
          content: [{ type: "text", text: "<end_task>r-abc123</end_task>" }],
        },
        timestamp: Date.now(),
      },
      "ralph",
    )

    const result = await findIncompleteSession(persister, "r-abc123", "ralph")
    expect(result).toBeNull()
  })

  it("returns sessionId when session is incomplete (has start_task but no end_task)", async () => {
    // Create an incomplete session
    await persister.appendEvent(
      "incomplete-session",
      {
        type: "session_created",
        sessionId: "incomplete-session",
        adapter: "claude",
        timestamp: Date.now(),
      },
      "ralph",
    )
    await persister.appendEvent(
      "incomplete-session",
      {
        type: "assistant",
        message: {
          content: [{ type: "text", text: "<start_task>r-abc123</start_task>" }],
        },
        timestamp: Date.now(),
      },
      "ralph",
    )
    // No end_task event

    const result = await findIncompleteSession(persister, "r-abc123", "ralph")
    expect(result).toBe("incomplete-session")
  })

  it("returns incomplete session when multiple sessions exist (one complete, one incomplete)", async () => {
    // Create a complete session first
    await persister.appendEvent(
      "complete-session",
      {
        type: "session_created",
        sessionId: "complete-session",
        adapter: "claude",
        timestamp: Date.now(),
      },
      "ralph",
    )
    await persister.appendEvent(
      "complete-session",
      {
        type: "assistant",
        message: {
          content: [{ type: "text", text: "<start_task>r-abc123</start_task>" }],
        },
        timestamp: Date.now(),
      },
      "ralph",
    )
    await persister.appendEvent(
      "complete-session",
      {
        type: "assistant",
        message: {
          content: [{ type: "text", text: "<end_task>r-abc123</end_task>" }],
        },
        timestamp: Date.now(),
      },
      "ralph",
    )

    // Create an incomplete session
    await persister.appendEvent(
      "incomplete-session",
      {
        type: "session_created",
        sessionId: "incomplete-session",
        adapter: "claude",
        timestamp: Date.now(),
      },
      "ralph",
    )
    await persister.appendEvent(
      "incomplete-session",
      {
        type: "assistant",
        message: {
          content: [{ type: "text", text: "<start_task>r-abc123</start_task>" }],
        },
        timestamp: Date.now(),
      },
      "ralph",
    )

    const result = await findIncompleteSession(persister, "r-abc123", "ralph")
    expect(result).toBe("incomplete-session")
  })

  it("handles task IDs with subtask levels (e.g., r-abc123.1)", async () => {
    await persister.appendEvent(
      "subtask-session",
      {
        type: "session_created",
        sessionId: "subtask-session",
        adapter: "claude",
        timestamp: Date.now(),
      },
      "ralph",
    )
    await persister.appendEvent(
      "subtask-session",
      {
        type: "assistant",
        message: {
          content: [{ type: "text", text: "<start_task>r-abc123.1</start_task>" }],
        },
        timestamp: Date.now(),
      },
      "ralph",
    )

    const result = await findIncompleteSession(persister, "r-abc123.1", "ralph")
    expect(result).toBe("subtask-session")
  })

  it("handles task IDs with multiple subtask levels (e.g., r-abc123.1.2)", async () => {
    await persister.appendEvent(
      "deep-subtask-session",
      {
        type: "session_created",
        sessionId: "deep-subtask-session",
        adapter: "claude",
        timestamp: Date.now(),
      },
      "ralph",
    )
    await persister.appendEvent(
      "deep-subtask-session",
      {
        type: "assistant",
        message: {
          content: [{ type: "text", text: "<start_task>r-abc123.1.2</start_task>" }],
        },
        timestamp: Date.now(),
      },
      "ralph",
    )

    const result = await findIncompleteSession(persister, "r-abc123.1.2", "ralph")
    expect(result).toBe("deep-subtask-session")
  })

  it("handles markers embedded in longer text", async () => {
    await persister.appendEvent(
      "embedded-session",
      {
        type: "session_created",
        sessionId: "embedded-session",
        adapter: "claude",
        timestamp: Date.now(),
      },
      "ralph",
    )
    await persister.appendEvent(
      "embedded-session",
      {
        type: "assistant",
        message: {
          content: [
            {
              type: "text",
              text: "I'll start working on this now.\n\n<start_task>r-abc123</start_task>\n\nLet me check the requirements...",
            },
          ],
        },
        timestamp: Date.now(),
      },
      "ralph",
    )

    const result = await findIncompleteSession(persister, "r-abc123", "ralph")
    expect(result).toBe("embedded-session")
  })

  it("handles multiple content blocks in a single message", async () => {
    await persister.appendEvent(
      "multi-block-session",
      {
        type: "session_created",
        sessionId: "multi-block-session",
        adapter: "claude",
        timestamp: Date.now(),
      },
      "ralph",
    )
    await persister.appendEvent(
      "multi-block-session",
      {
        type: "assistant",
        message: {
          content: [
            { type: "text", text: "First block" },
            { type: "text", text: "<start_task>r-abc123</start_task>" },
            { type: "text", text: "Third block" },
          ],
        },
        timestamp: Date.now(),
      },
      "ralph",
    )

    const result = await findIncompleteSession(persister, "r-abc123", "ralph")
    expect(result).toBe("multi-block-session")
  })

  it("ignores sessions from other apps", async () => {
    // Create a session in a different app
    await persister.appendEvent(
      "other-app-session",
      {
        type: "session_created",
        sessionId: "other-app-session",
        adapter: "claude",
        timestamp: Date.now(),
      },
      "task-chat", // Different app
    )
    await persister.appendEvent(
      "other-app-session",
      {
        type: "assistant",
        message: {
          content: [{ type: "text", text: "<start_task>r-abc123</start_task>" }],
        },
        timestamp: Date.now(),
      },
      "task-chat",
    )

    const result = await findIncompleteSession(persister, "r-abc123", "ralph")
    expect(result).toBeNull()
  })

  it("handles sessions with workspace", async () => {
    const workspace = "owner/repo"

    await persister.appendEvent(
      "workspace-session",
      {
        type: "session_created",
        sessionId: "workspace-session",
        adapter: "claude",
        timestamp: Date.now(),
      },
      "ralph",
      workspace,
    )
    await persister.appendEvent(
      "workspace-session",
      {
        type: "assistant",
        message: {
          content: [{ type: "text", text: "<start_task>r-abc123</start_task>" }],
        },
        timestamp: Date.now(),
      },
      "ralph",
      workspace,
    )

    const result = await findIncompleteSession(persister, "r-abc123", "ralph")
    expect(result).toBe("workspace-session")
  })
})

describe("findAnyIncompleteSession", () => {
  let storageDir: string
  let persister: SessionPersister

  beforeEach(() => {
    storageDir = mkdtempSync(join(tmpdir(), "find-any-incomplete-test-"))
    persister = new SessionPersister(storageDir)
  })

  it("returns null when no sessions exist", async () => {
    const result = await findAnyIncompleteSession(persister, "ralph")
    expect(result).toBeNull()
  })

  it("returns null when all sessions are complete", async () => {
    await persister.appendEvent(
      "complete-session",
      {
        type: "session_created",
        sessionId: "complete-session",
        adapter: "claude",
        timestamp: Date.now(),
      },
      "ralph",
    )
    await persister.appendEvent(
      "complete-session",
      {
        type: "assistant",
        message: {
          content: [{ type: "text", text: "<start_task>r-abc123</start_task>" }],
        },
        timestamp: Date.now(),
      },
      "ralph",
    )
    await persister.appendEvent(
      "complete-session",
      {
        type: "assistant",
        message: {
          content: [{ type: "text", text: "<end_task>r-abc123</end_task>" }],
        },
        timestamp: Date.now(),
      },
      "ralph",
    )

    const result = await findAnyIncompleteSession(persister, "ralph")
    expect(result).toBeNull()
  })

  it("returns sessionId and taskId when an incomplete session exists", async () => {
    await persister.appendEvent(
      "incomplete-session",
      {
        type: "session_created",
        sessionId: "incomplete-session",
        adapter: "claude",
        timestamp: Date.now(),
      },
      "ralph",
    )
    await persister.appendEvent(
      "incomplete-session",
      {
        type: "assistant",
        message: {
          content: [{ type: "text", text: "<start_task>r-xyz789</start_task>" }],
        },
        timestamp: Date.now(),
      },
      "ralph",
    )

    const result = await findAnyIncompleteSession(persister, "ralph")
    expect(result).not.toBeNull()
    expect(result!.sessionId).toBe("incomplete-session")
    expect(result!.taskId).toBe("r-xyz789")
  })

  it("returns the first incomplete session when multiple incomplete sessions exist", async () => {
    // First incomplete session
    await persister.appendEvent(
      "incomplete-1",
      {
        type: "session_created",
        sessionId: "incomplete-1",
        adapter: "claude",
        timestamp: Date.now(),
      },
      "ralph",
    )
    await persister.appendEvent(
      "incomplete-1",
      {
        type: "assistant",
        message: {
          content: [{ type: "text", text: "<start_task>r-task1</start_task>" }],
        },
        timestamp: Date.now(),
      },
      "ralph",
    )

    // Second incomplete session
    await persister.appendEvent(
      "incomplete-2",
      {
        type: "session_created",
        sessionId: "incomplete-2",
        adapter: "claude",
        timestamp: Date.now(),
      },
      "ralph",
    )
    await persister.appendEvent(
      "incomplete-2",
      {
        type: "assistant",
        message: {
          content: [{ type: "text", text: "<start_task>r-task2</start_task>" }],
        },
        timestamp: Date.now(),
      },
      "ralph",
    )

    const result = await findAnyIncompleteSession(persister, "ralph")
    expect(result).not.toBeNull()
    // Should return one of them (first found)
    expect(["incomplete-1", "incomplete-2"]).toContain(result!.sessionId)
  })

  it("includes workspace info in the result", async () => {
    const workspace = "owner/repo"

    await persister.appendEvent(
      "workspace-session",
      {
        type: "session_created",
        sessionId: "workspace-session",
        adapter: "claude",
        timestamp: Date.now(),
      },
      "ralph",
      workspace,
    )
    await persister.appendEvent(
      "workspace-session",
      {
        type: "assistant",
        message: {
          content: [{ type: "text", text: "<start_task>r-abc123</start_task>" }],
        },
        timestamp: Date.now(),
      },
      "ralph",
      workspace,
    )

    const result = await findAnyIncompleteSession(persister, "ralph")
    expect(result).not.toBeNull()
    expect(result!.sessionId).toBe("workspace-session")
    expect(result!.taskId).toBe("r-abc123")
    expect(result!.workspace).toBe(workspace)
    expect(result!.app).toBe("ralph")
  })

  it("ignores sessions from other apps", async () => {
    // Create incomplete session in different app
    await persister.appendEvent(
      "other-app-session",
      {
        type: "session_created",
        sessionId: "other-app-session",
        adapter: "claude",
        timestamp: Date.now(),
      },
      "task-chat",
    )
    await persister.appendEvent(
      "other-app-session",
      {
        type: "assistant",
        message: {
          content: [{ type: "text", text: "<start_task>r-abc123</start_task>" }],
        },
        timestamp: Date.now(),
      },
      "task-chat",
    )

    const result = await findAnyIncompleteSession(persister, "ralph")
    expect(result).toBeNull()
  })
})
