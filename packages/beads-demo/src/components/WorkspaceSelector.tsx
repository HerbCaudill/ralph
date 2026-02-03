import { useState } from "react"
import { IconLayoutList, IconCheck, IconLoader2 } from "@tabler/icons-react"
import type { Workspace } from "../hooks/useWorkspace"

export type WorkspaceSelectorProps = {
  current: Workspace | null
  workspaces: Workspace[]
  isLoading: boolean
  onSwitch: (path: string) => void
}

/**
 * Workspace selector button with dropdown for switching workspaces.
 */
export function WorkspaceSelector({
  current,
  workspaces,
  isLoading,
  onSwitch,
}: WorkspaceSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)

  const displayName = current?.name ?? current?.issuePrefix ?? "No workspace"

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
      >
        {isLoading ?
          <IconLoader2 size={16} stroke={1.5} className="animate-spin" />
        : <IconLayoutList size={16} stroke={1.5} />}
        {displayName}
        {current?.branch && <span className="text-muted-foreground">({current.branch})</span>}
      </button>

      {/* Dropdown */}
      {isOpen && workspaces.length > 0 && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />

          <div className="absolute right-0 top-full z-20 mt-1 min-w-[240px] rounded-md border border-border bg-background shadow-lg">
            <div className="px-3 py-2 text-xs font-medium text-muted-foreground">Workspaces</div>
            {workspaces.map(ws => {
              const isCurrent = ws.path === current?.path
              return (
                <button
                  key={ws.path}
                  onClick={() => {
                    if (!isCurrent) onSwitch(ws.path)
                    setIsOpen(false)
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-muted ${
                    isCurrent ? "font-medium" : ""
                  }`}
                >
                  {isCurrent ?
                    <IconCheck size={14} stroke={2} className="shrink-0" />
                  : <span className="w-3.5 shrink-0" />}
                  <span className="min-w-0 truncate">{ws.name}</span>
                  {ws.issueCount != null && (
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                      {ws.issueCount}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
