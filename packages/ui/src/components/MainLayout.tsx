import { useState, useCallback, useEffect, type ReactNode, type MouseEvent } from "react"
import { cn } from "../lib/utils"
import { useUiStore } from "../stores/uiStore"

/**
 * Main application layout with three resizable panels using CSS and mouse events.
 * Panel widths are stored as percentages of viewport width and persisted to localStorage.
 * - Left sidebar (resizable, min 200px, max 50%, default 20%)
 * - Center panel (main content, flexible)
 * - Right panel (optional, resizable, min 200px, max 70%, default 30%)
 */
export function MainLayout({ sidebar, rightPanel, overlay, children }: MainLayoutProps) {
  const sidebarWidthPercent = useUiStore(state => state.sidebarWidthPercent)
  const rightPanelWidthPercent = useUiStore(state => state.rightPanelWidthPercent)
  const setSidebarWidthPercent = useUiStore(state => state.setSidebarWidthPercent)
  const setRightPanelWidthPercent = useUiStore(state => state.setRightPanelWidthPercent)

  // Local state for dragging - we track pixels during drag for smoothness
  const [leftWidth, setLeftWidth] = useState(() => percentToPixels(sidebarWidthPercent))
  const [rightWidth, setRightWidth] = useState(() => percentToPixels(rightPanelWidthPercent))
  const [isResizingLeft, setIsResizingLeft] = useState(false)
  const [isResizingRight, setIsResizingRight] = useState(false)

  // Sync local state with store when store changes (e.g., on mount from localStorage)
  useEffect(() => {
    setLeftWidth(percentToPixels(sidebarWidthPercent))
  }, [sidebarWidthPercent])

  useEffect(() => {
    setRightWidth(percentToPixels(rightPanelWidthPercent))
  }, [rightPanelWidthPercent])

  // Update pixel values on window resize to maintain percentage-based layout
  useEffect(() => {
    const handleResize = () => {
      setLeftWidth(percentToPixels(sidebarWidthPercent))
      setRightWidth(percentToPixels(rightPanelWidthPercent))
    }
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [sidebarWidthPercent, rightPanelWidthPercent])

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
    // Persist to store as percentages when drag ends
    if (isResizingLeft) {
      setSidebarWidthPercent(pixelsToPercent(leftWidth))
    }
    if (isResizingRight) {
      setRightPanelWidthPercent(pixelsToPercent(rightWidth))
    }
    setIsResizingLeft(false)
    setIsResizingRight(false)
  }, [
    isResizingLeft,
    isResizingRight,
    leftWidth,
    rightWidth,
    setSidebarWidthPercent,
    setRightPanelWidthPercent,
  ])

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
      <main className="bg-background relative z-10 flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        {children}
      </main>

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
          <div
            className="relative flex h-full flex-col"
            style={{ width: rightWidth, minWidth: MIN_PANEL_WIDTH }}
          >
            <aside className="bg-background flex h-full w-full flex-col overflow-hidden border-l border-border">
              {rightPanel}
            </aside>
            {overlay}
          </div>
        </>
      )}
    </div>
  )
}

/** Convert percentage to pixels based on current viewport width. */
function percentToPixels(percent: number): number {
  return (percent / 100) * window.innerWidth
}

/** Convert pixels to percentage based on current viewport width. */
function pixelsToPercent(pixels: number): number {
  return (pixels / window.innerWidth) * 100
}

/** Minimum width for panels in pixels. */
const MIN_PANEL_WIDTH = 200

export type MainLayoutProps = {
  /** Optional sidebar content (left panel, resizable). */
  sidebar?: ReactNode
  /** Optional right panel content (toggleable). */
  rightPanel?: ReactNode
  /** Optional overlay rendered inside the right panel area, anchored to its left edge. */
  overlay?: ReactNode
  /** Main content area (center panel). */
  children: ReactNode
}
