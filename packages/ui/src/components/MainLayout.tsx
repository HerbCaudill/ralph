import { useState, useCallback, type ReactNode, type MouseEvent } from "react"
import { cn } from "../lib/utils"

/**
 * Main application layout with three resizable panels using CSS and mouse events.
 * - Left sidebar (resizable, min 200px, max 50%, default 25%)
 * - Center panel (main content, flexible)
 * - Right panel (optional, resizable, min 200px, max 70%, default 35%)
 */
export function MainLayout({ sidebar, rightPanel, children }: MainLayoutProps) {
  const [leftWidth, setLeftWidth] = useState(DEFAULT_LEFT_WIDTH)
  const [rightWidth, setRightWidth] = useState(DEFAULT_RIGHT_WIDTH)
  const [isResizingLeft, setIsResizingLeft] = useState(false)
  const [isResizingRight, setIsResizingRight] = useState(false)

  const handleLeftMouseDown = useCallback((e: MouseEvent) => {
    e.preventDefault()
    setIsResizingLeft(true)
  }, [])

  const handleRightMouseDown = useCallback((e: MouseEvent) => {
    e.preventDefault()
    setIsResizingRight(true)
  }, [])

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isResizingLeft) {
        const newWidth = Math.min(Math.max(e.clientX, MIN_PANEL_WIDTH), window.innerWidth * 0.5)
        setLeftWidth(newWidth)
      } else if (isResizingRight) {
        const newWidth = Math.min(
          Math.max(window.innerWidth - e.clientX, MIN_PANEL_WIDTH),
          window.innerWidth * 0.7,
        )
        setRightWidth(newWidth)
      }
    },
    [isResizingLeft, isResizingRight],
  )

  const handleMouseUp = useCallback(() => {
    setIsResizingLeft(false)
    setIsResizingRight(false)
  }, [])

  return (
    <div
      className="flex h-full w-full overflow-hidden"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Left sidebar */}
      {sidebar && (
        <>
          <aside
            className="bg-background flex h-full flex-col overflow-hidden border-r border-border"
            style={{ width: leftWidth, minWidth: MIN_PANEL_WIDTH }}
          >
            {sidebar}
          </aside>
          <div
            className={cn(
              "w-1 cursor-col-resize transition-colors hover:bg-primary/20",
              isResizingLeft && "bg-primary/30",
            )}
            onMouseDown={handleLeftMouseDown}
            data-testid="sidebar-resize-handle"
          />
        </>
      )}

      {/* Center panel */}
      <main className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">{children}</main>

      {/* Right panel */}
      {rightPanel && (
        <>
          <div
            className={cn(
              "w-1 cursor-col-resize transition-colors hover:bg-primary/20",
              isResizingRight && "bg-primary/30",
            )}
            onMouseDown={handleRightMouseDown}
            data-testid="right-panel-resize-handle"
          />
          <aside
            className="bg-background flex h-full flex-col overflow-hidden border-l border-border"
            style={{ width: rightWidth, minWidth: MIN_PANEL_WIDTH }}
          >
            {rightPanel}
          </aside>
        </>
      )}
    </div>
  )
}

/** Minimum width for panels in pixels. */
const MIN_PANEL_WIDTH = 200

/** Default width for the left sidebar in pixels. */
const DEFAULT_LEFT_WIDTH = 300

/** Default width for the right panel in pixels. */
const DEFAULT_RIGHT_WIDTH = 420

export type MainLayoutProps = {
  /** Optional sidebar content (left panel, resizable). */
  sidebar?: ReactNode
  /** Optional right panel content (toggleable). */
  rightPanel?: ReactNode
  /** Main content area (center panel). */
  children: ReactNode
}
