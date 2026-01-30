import { AgentViewContext, DEFAULT_AGENT_VIEW_CONTEXT } from "./AgentViewContext"
import type { AgentViewContextValue } from "../types"
import type { ReactNode } from "react"

/** Provider for agent-view context. */
export function AgentViewProvider({
  /** Child elements that can consume the context */
  children,
  /** Context overrides */
  value,
}: AgentViewProviderProps) {
  const resolvedValue: AgentViewContextValue = {
    ...DEFAULT_AGENT_VIEW_CONTEXT,
    ...value,
    linkHandlers: {
      ...DEFAULT_AGENT_VIEW_CONTEXT.linkHandlers,
      ...value?.linkHandlers,
    },
  }

  return <AgentViewContext.Provider value={resolvedValue}>{children}</AgentViewContext.Provider>
}

interface AgentViewProviderProps {
  /** Child elements that can consume the context */
  children: ReactNode
  /** Context value overrides */
  value?: Partial<AgentViewContextValue>
}
