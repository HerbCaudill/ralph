import { useContext } from "react"
import { AgentViewContext } from "./AgentViewContext"

/** Access the shared agent-view context. */
export function useAgentViewContext() {
  return useContext(AgentViewContext)
}
