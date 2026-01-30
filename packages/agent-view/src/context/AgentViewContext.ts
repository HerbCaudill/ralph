import { createContext } from "react"
import type { AgentViewContextValue } from "../types"

/** Default context values for agent-view. */
export const DEFAULT_AGENT_VIEW_CONTEXT: AgentViewContextValue = {
  isDark: false,
  linkHandlers: {},
  toolOutput: undefined,
  workspacePath: undefined,
}

/** Shared context for agent-view components. */
export const AgentViewContext = createContext<AgentViewContextValue>(DEFAULT_AGENT_VIEW_CONTEXT)
