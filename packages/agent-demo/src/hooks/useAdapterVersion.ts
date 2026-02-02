import { useEffect, useState } from "react"
import type { AgentType } from "./useAgentChat"

interface AdapterInfo {
  id: string
  name: string
  version?: string
  available: boolean
}

/**
 * Fetches adapter info from the server and returns the version string
 * for the currently selected agent type.
 */
export function useAdapterVersion(agentType: AgentType): string | undefined {
  const [adapters, setAdapters] = useState<AdapterInfo[]>([])

  useEffect(() => {
    fetch("/api/adapters")
      .then(res => res.json())
      .then((data: { adapters: Array<AdapterInfo & { info?: { version?: string } }> }) => {
        setAdapters(
          data.adapters.map(a => ({
            id: a.id,
            name: a.name,
            version: a.info?.version,
            available: a.available,
          })),
        )
      })
      .catch(() => {
        // Ignore fetch errors — version is informational only
      })
  }, [])

  return adapters.find(a => a.id === agentType)?.version
}
