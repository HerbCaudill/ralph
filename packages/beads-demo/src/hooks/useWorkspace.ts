import { useCallback, useEffect, useState } from "react"

export type Workspace = {
  path: string
  name: string
  issueCount?: number
  branch?: string
  accentColor?: string
  issuePrefix?: string
}

export type WorkspaceState = {
  current: Workspace | null
  workspaces: Workspace[]
  isLoading: boolean
  error: string | null
}

/**
 * Hook that fetches workspace info and provides workspace switching.
 */
export function useWorkspace() {
  const [current, setCurrent] = useState<Workspace | null>(null)
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchWorkspace = useCallback(async () => {
    try {
      const res = await fetch("/api/workspace")
      if (!res.ok) throw new Error("Failed to fetch workspace")
      const data = (await res.json()) as Workspace & { ok: boolean }
      if (data.ok !== false) {
        setCurrent(data)
      }
    } catch (e) {
      setError((e as Error).message)
    }
  }, [])

  const fetchWorkspaces = useCallback(async () => {
    try {
      const res = await fetch("/api/workspaces")
      if (!res.ok) return
      const data = (await res.json()) as {
        ok: boolean
        workspaces: Workspace[]
      }
      if (data.ok !== false && data.workspaces) {
        setWorkspaces(data.workspaces)
      }
    } catch {
      // Ignore - workspaces list is optional
    }
  }, [])

  const switchWorkspace = useCallback(
    async (path: string) => {
      try {
        setIsLoading(true)
        const res = await fetch("/api/workspace/switch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path }),
        })
        if (!res.ok) throw new Error("Failed to switch workspace")
        await fetchWorkspace()
      } catch (e) {
        setError((e as Error).message)
      } finally {
        setIsLoading(false)
      }
    },
    [fetchWorkspace],
  )

  useEffect(() => {
    const init = async () => {
      setIsLoading(true)
      await Promise.all([fetchWorkspace(), fetchWorkspaces()])
      setIsLoading(false)
    }
    void init()
  }, [fetchWorkspace, fetchWorkspaces])

  return {
    state: { current, workspaces, isLoading, error },
    actions: { switchWorkspace, refresh: fetchWorkspace },
  }
}
