import type { Decorator } from "@storybook/react-vite"
import { useEffect, useState } from "react"
import { useAppStore } from "../src/store"
import type { RalphInstance, RalphStatus } from "../src/types"
import { importStateFromUrl, clearImportedState } from "../src/lib/importState"

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
      // Note: runStartedAt is stored within the active instance in the instances Map
      if (state.runStartedAt !== undefined || state.ralphStatus === "running") {
        useAppStore.setState(currentState => {
          const activeInstance = currentState.instances.get(currentState.activeInstanceId)
          if (!activeInstance) return currentState

          const runStartedAt =
            state.runStartedAt !== undefined ? state.runStartedAt
              // Auto-set runStartedAt to a time in the past for a realistic display (2:05 elapsed)
            : state.ralphStatus === "running" ? Date.now() - 125000
            : activeInstance.runStartedAt

          const updatedInstances = new Map(currentState.instances)
          updatedInstances.set(currentState.activeInstanceId, {
            ...activeInstance,
            runStartedAt,
          })

          return { instances: updatedInstances }
        })
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

/** Loading state for imported state decorator */
type ImportStatus = "loading" | "ready" | "error"

/**
 * Decorator that loads state from a compressed JSON file before rendering.
 *
 * Fetches the gzipped state file, decompresses it, and restores both
 * localStorage (Zustand state) and IndexedDB (sessions, events, etc.)
 * before rendering the story.
 *
 * @param stateUrl - URL to the .json.gz state file (relative to Storybook's staticDirs)
 *
 * @example
 * ```tsx
 * export const ReproduceIssue: Story = {
 *   decorators: [withImportedState('/fixtures/reproduce-h5j8.json.gz')],
 * }
 * ```
 */
export function withImportedState(stateUrl: string): Decorator {
  return Story => {
    const [status, setStatus] = useState<ImportStatus>("loading")
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
      let mounted = true

      async function loadState() {
        try {
          await importStateFromUrl(stateUrl)
          if (mounted) {
            setStatus("ready")
          }
        } catch (err) {
          if (mounted) {
            setStatus("error")
            setError(err instanceof Error ? err.message : "Failed to load state")
          }
        }
      }

      loadState()

      // Cleanup on unmount
      return () => {
        mounted = false
        clearImportedState().catch(console.error)
      }
    }, [])

    if (status === "loading") {
      return (
        <div className="bg-background text-foreground flex h-screen w-screen items-center justify-center">
          <div className="text-center">
            <div className="mb-4 text-lg font-medium">Loading state...</div>
            <div className="text-muted-foreground text-sm">
              Decompressing and importing {stateUrl}
            </div>
          </div>
        </div>
      )
    }

    if (status === "error") {
      return (
        <div className="bg-background text-foreground flex h-screen w-screen items-center justify-center">
          <div className="text-center">
            <div className="text-destructive mb-4 text-lg font-medium">Failed to load state</div>
            <div className="text-muted-foreground text-sm">{error}</div>
          </div>
        </div>
      )
    }

    return <Story />
  }
}
