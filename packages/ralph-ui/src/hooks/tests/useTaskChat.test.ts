import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook } from "@testing-library/react"
import { useTaskChat } from "../useTaskChat"
import MANAGE_TASKS_SYSTEM_PROMPT from "@herbcaudill/ralph-shared/templates/manage-tasks.prompt.md?raw"

const { mockUseAgentChat } = vi.hoisted(() => ({
  mockUseAgentChat: vi.fn(),
}))

vi.mock("@herbcaudill/agent-view", () => ({
  useAgentChat: mockUseAgentChat,
}))

describe("useTaskChat", () => {
  beforeEach(() => {
    mockUseAgentChat.mockReset()
    mockUseAgentChat.mockReturnValue({
      state: {
        events: [],
        isStreaming: false,
        connectionStatus: "connected",
        error: null,
        sessionId: null,
      },
      actions: {
        sendMessage: vi.fn(),
        clearHistory: vi.fn(),
        setAgentType: vi.fn(),
        newSession: vi.fn(),
        restoreSession: vi.fn(),
      },
      agentType: "claude",
    })
  })

  it("configures task-chat app namespace, storage key, and system prompt", () => {
    renderHook(() => useTaskChat("workspace-123"))

    expect(mockUseAgentChat).toHaveBeenCalledWith(
      expect.objectContaining({
        app: "task-chat",
        storageKey: "ralph-task-chat-workspace-123",
        systemPrompt: MANAGE_TASKS_SYSTEM_PROMPT,
        allowedTools: ["Read", "Glob", "Grep", "LS", "Bash", "Task", "WebFetch", "WebSearch"],
      }),
    )
  })
})
