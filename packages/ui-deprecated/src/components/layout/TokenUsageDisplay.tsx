import { useShallow } from "zustand/react/shallow"
import { useAppStore, selectTokenUsage } from "@/store"
import { TokenUsageDisplay as TokenUsageDisplayBase } from "@herbcaudill/agent-view"

/** Controller that connects the store-agnostic TokenUsageDisplay to the Zustand store. */
export function TokenUsageDisplay({}: Props) {
  const tokenUsage = useAppStore(useShallow(selectTokenUsage))
  return <TokenUsageDisplayBase tokenUsage={tokenUsage} />
}

type Props = {}
