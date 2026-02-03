import { useEffect, useState } from "react"
import type { AgentType } from "./useAgentChat"

interface AdapterInfo {
  id: string
  name: string
  version?: string
  model?: string
  available: boolean
}

/**
 * Fetches adapter info from the server and returns version and model strings
 * for the currently selected agent type.
 */
export function useAdapterInfo(agentType: AgentType): { version?: string; model?: string } {
  const [adapters, setAdapters] = useState<AdapterInfo[]>([])

  useEffect(() => {
    fetch("/api/adapters")
      .then(res => res.json())
      .then(
        (data: {
          adapters: Array<AdapterInfo & { info?: { version?: string; model?: string } }>
        }) => {
          setAdapters(
            data.adapters.map(a => ({
              id: a.id,
              name: a.name,
              version: a.info?.version,
              model: a.info?.model,
              available: a.available,
            })),
          )
        },
      )
      .catch(() => {
        // Ignore fetch errors — version/model info is informational only
      })
  }, [])

  const adapter = adapters.find(a => a.id === agentType)
  return { version: adapter?.version, model: adapter?.model }
}

/**
 * Fetches adapter info from the server and returns the version string
 * for the currently selected agent type.
 * @deprecated Use useAdapterInfo instead
 */
export function useAdapterVersion(agentType: AgentType): string | undefined {
  return useAdapterInfo(agentType).version
}
