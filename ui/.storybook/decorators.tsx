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
  iteration?: { current: number; total: number }
  accentColor?: string | null
  /** Multi-instance state */
  instances?: Map<string, RalphInstance>
  activeInstanceId?: string
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
      if (state.iteration !== undefined) {
        store.setIteration(state.iteration)
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
