import type { ReactNode } from "react"
import { AgentViewProvider } from "@herbcaudill/agent-view"
import type { AgentViewContextValue } from "@herbcaudill/agent-view"

/** Default context value for tests. Provides sensible defaults for link handlers and tool output. */
export const defaultTestContext: Partial<AgentViewContextValue> = {
  isDark: false,
  linkHandlers: {
    taskIdPrefix: "rui",
    buildTaskHref: (id: string) => `/issue/${id}`,
    buildSessionHref: (id: string) => `/session/${id}`,
    onTaskClick: undefined,
    onSessionClick: undefined,
  },
  toolOutput: {
    isVisible: true,
    onToggle: () => {},
  },
  workspacePath: undefined,
  tasks: [],
}

/** Wraps children in an AgentViewProvider with test defaults. Overrides are merged shallowly. */
export function AgentViewTestWrapper({ children, value }: AgentViewTestWrapperProps) {
  const merged: Partial<AgentViewContextValue> = {
    ...defaultTestContext,
    ...value,
    linkHandlers: {
      ...defaultTestContext.linkHandlers,
      ...value?.linkHandlers,
    },
  }

  return <AgentViewProvider value={merged}>{children}</AgentViewProvider>
}

interface AgentViewTestWrapperProps {
  children: ReactNode
  value?: Partial<AgentViewContextValue>
}
