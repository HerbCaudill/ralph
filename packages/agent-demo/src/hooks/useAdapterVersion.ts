import { useEffect, useState } from "react"
import type { AgentType } from "@herbcaudill/agent-view"

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

/**
 * Convert a model ID like "claude-sonnet-4-20250514" to a friendly name like "Sonnet 4".
 * Returns undefined if the model ID doesn't match a known pattern.
 */
export function formatModelName(modelId: string | undefined): string | undefined {
  if (!modelId) return undefined

  // Match patterns like "claude-sonnet-4-20250514" or "claude-opus-4-5-20251101"
  const match = modelId.match(/^claude-(\w+)-(\d+(?:-\d+)?)-\d{8}$/)
  if (!match) return modelId

  const [, family, versionParts] = match
  const name = family.charAt(0).toUpperCase() + family.slice(1)
  const version = versionParts.replace("-", ".")

  return `${name} ${version}`
}
