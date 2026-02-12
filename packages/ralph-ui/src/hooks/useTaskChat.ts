import { useAgentChat } from "@herbcaudill/agent-view"
import MANAGE_TASKS_SYSTEM_PROMPT from "@herbcaudill/ralph-shared/templates/manage-tasks.prompt.md?raw"
import { TASK_CHAT_ALLOWED_TOOLS } from "./constants"

/**
 * Hook for task-specific chat functionality.
 * Uses agent-server with manage-tasks system prompt.
 * Sessions are stored in the "task-chat" app namespace.
 * Includes workspaceId in the storage key so sessions don't persist across workspace switches.
 */
export function useTaskChat(
  /** The current workspace ID, used to scope session persistence. */
  workspaceId?: string,
) {
  const storageKey = workspaceId ? `ralph-task-chat-${workspaceId}` : "ralph-task-chat"

  const { state, actions, agentType } = useAgentChat({
    systemPrompt: MANAGE_TASKS_SYSTEM_PROMPT,
    storageKey,
    app: "task-chat",
    workspace: null, // Don't derive workspace for task-chat sessions
    allowedTools: [...TASK_CHAT_ALLOWED_TOOLS],
  })

  return {
    state: {
      ...state,
    },
    actions: {
      ...actions,
    },
    agentType,
  }
}
