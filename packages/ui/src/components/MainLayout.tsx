import type { ReactNode } from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import { cn } from "../lib/utils"

/**
 * Main application layout with three panels:
 * - Left sidebar (resizable, min 200px, max 400px)
 * - Center panel (main content)
 * - Right panel (optional, toggleable)
 */
export function MainLayout({ sidebar, rightPanel, children }: MainLayoutProps) {
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH)
  const [isResizing, setIsResizing] = useState(false)
  const sidebarRef = useRef<HTMLElement>(null)

  const handleMouseDown = useCallback(() => {
    setIsResizing(true)
  }, [])

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing) return
      const newWidth = Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, e.clientX))
      setSidebarWidth(newWidth)
    },
    [isResizing],
  )

  const handleMouseUp = useCallback(() => {
    setIsResizing(false)
  }, [])

  useEffect(() => {
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
      document.body.style.userSelect = "none"
      document.body.style.cursor = "col-resize"
    } else {
      document.body.style.userSelect = ""
      document.body.style.cursor = ""
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }
  }, [isResizing, handleMouseMove, handleMouseUp])

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      {/* Left sidebar */}
      {sidebar && (
        <aside
          ref={sidebarRef}
          className="bg-background relative flex h-full shrink-0 flex-col overflow-hidden border-r border-border"
          style={{ width: sidebarWidth }}
        >
          {sidebar}
          <div
            className={cn(
              "absolute top-0 right-0 h-full w-1 cursor-col-resize",
              "hover:bg-primary/20 hover:w-2",
              isResizing && "bg-primary/30 w-2",
            )}
            onMouseDown={handleMouseDown}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize sidebar"
            data-testid="sidebar-resize-handle"
          />
        </aside>
      )}

      {/* Center panel */}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">{children}</main>

      {/* Right panel */}
      {rightPanel && (
        <aside className="bg-background flex h-full shrink-0 flex-col overflow-hidden border-l border-border">
          {rightPanel}
        </aside>
      )}
    </div>
  )
}

/** Minimum width for the sidebar in pixels. */
const MIN_SIDEBAR_WIDTH = 200

/** Maximum width for the sidebar in pixels. */
const MAX_SIDEBAR_WIDTH = 400

/** Default width for the sidebar in pixels. */
const DEFAULT_SIDEBAR_WIDTH = 320

export type MainLayoutProps = {
  /** Optional sidebar content (left panel, resizable). */
  sidebar?: ReactNode
  /** Optional right panel content (toggleable). */
  rightPanel?: ReactNode
  /** Main content area (center panel). */
  children: ReactNode
}
