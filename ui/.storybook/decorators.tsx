import type { Decorator } from "@storybook/react-vite"
import { useEffect } from "react"
import { useAppStore } from "../src/store"
import type { RalphInstance, RalphStatus } from "../src/types"

/** Connection status type for Storybook decorators */
type ConnectionStatus = "connected" | "connecting" | "disconnected"

/**  Props for configuring the store state in stories */
export interface StoreState {
  connectionStatus?: ConnectionStatus
  ralphStatus?: RalphStatus
  workspace?: string | null
  branch?: string | null
  tokenUsage?: { input: number; output: number }
  session?: { current: number; total: number }
  accentColor?: string | null
  /** Multi-instance state */
  instances?: Map<string, RalphInstance>
  activeInstanceId?: string
  /** When the current run started (timestamp) - auto-set when ralphStatus is "running" */
  runStartedAt?: number | null
}

/**  Decorator that initializes the Zustand store with specific state for stories */
export function withStoreState(state: StoreState): Decorator {
  return Story => {
    useEffect(() => {
      const store = useAppStore.getState()

      if (state.connectionStatus !== undefined) {
        store.setConnectionStatus(state.connectionStatus)
      }
      if (state.ralphStatus !== undefined) {
        store.setRalphStatus(state.ralphStatus)
      }
      if (state.workspace !== undefined) {
        store.setWorkspace(state.workspace)
      }
      if (state.branch !== undefined) {
        store.setBranch(state.branch)
      }
      if (state.tokenUsage !== undefined) {
        store.setTokenUsage(state.tokenUsage)
      }
      if (state.session !== undefined) {
        store.setSession(state.session)
      }
      if (state.accentColor !== undefined) {
        store.setAccentColor(state.accentColor)
      }
      if (state.instances !== undefined) {
        useAppStore.setState({ instances: state.instances })
      }
      if (state.activeInstanceId !== undefined) {
        useAppStore.setState({ activeInstanceId: state.activeInstanceId })
      }
      // Handle runStartedAt - if explicitly set, use that value; if status is "running" and not set, auto-set to now
      if (state.runStartedAt !== undefined) {
        useAppStore.setState({ runStartedAt: state.runStartedAt })
      } else if (state.ralphStatus === "running") {
        // Auto-set runStartedAt to a time in the past for a realistic display
        useAppStore.setState({ runStartedAt: Date.now() - 125000 }) // 2:05 elapsed
      }
    }, [])

    return <Story />
  }
}

/**  Decorator for full-page layouts */
export const fullPageDecorator: Decorator = Story => (
  <div className="h-screen w-screen">
    <Story />
  </div>
)
