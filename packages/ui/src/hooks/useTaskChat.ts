import { useAgentChat } from "@herbcaudill/agent-view"
import MANAGE_TASKS_SYSTEM_PROMPT from "@herbcaudill/ralph-shared/templates/manage-tasks.prompt.md?raw"

/**
 * Hook for task-specific chat functionality.
 * Uses agent-server with manage-tasks system prompt.
 * Separate storage from the main Ralph chat.
 */
export function useTaskChat() {
  const { state, actions, agentType } = useAgentChat({
    systemPrompt: MANAGE_TASKS_SYSTEM_PROMPT,
    storageKey: "ralph-task-chat",
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
