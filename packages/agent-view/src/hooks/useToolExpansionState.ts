import { useCallback, useMemo, useRef } from "react"

/**
 * Hook to manage tool expansion state for a session.
 * Returns a Map and setter that can be passed to AgentViewProvider.
 *
 * The state persists across re-renders but is scoped to the component's lifecycle.
 * When the session changes, unmount the component using this hook to reset the state.
 *
 * @example
 * ```tsx
 * function MyAgentView({ events, sessionId }) {
 *   const { toolExpansionState, setToolExpansionState } = useToolExpansionState()
 *
 *   return (
 *     <AgentView
 *       events={events}
 *       context={{ toolExpansionState, setToolExpansionState }}
 *     />
 *   )
 * }
 * ```
 */
export function useToolExpansionState() {
  // Use ref to persist state across re-renders without causing re-renders
  const stateRef = useRef<Map<string, boolean>>(new Map())

  // Memoize the setter to avoid reference changes
  const setToolExpansionState = useCallback((toolUseId: string, expanded: boolean) => {
    stateRef.current.set(toolUseId, expanded)
  }, [])

  // Clear all state (useful when switching sessions)
  const clearToolExpansionState = useCallback(() => {
    stateRef.current.clear()
  }, [])

  return useMemo(
    () => ({
      toolExpansionState: stateRef.current,
      setToolExpansionState,
      clearToolExpansionState,
    }),
    [setToolExpansionState, clearToolExpansionState],
  )
}
