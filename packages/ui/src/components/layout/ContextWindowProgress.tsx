import { useShallow } from "zustand/react/shallow"
import { useAppStore, selectContextWindow } from "@/store"
import { ContextWindowProgress as ContextWindowProgressBase } from "@herbcaudill/agent-view"

/** Controller that connects the store-agnostic ContextWindowProgress to the Zustand store. */
export function ContextWindowProgress({}: Props) {
  const contextWindow = useAppStore(useShallow(selectContextWindow))
  return <ContextWindowProgressBase contextWindow={contextWindow} />
}

type Props = {}
