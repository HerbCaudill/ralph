import { cn } from "@/lib/utils"
import { forwardRef, useImperativeHandle, useRef, useCallback, useState, useEffect } from "react"
import { Header } from "./Header"
import { useAppStore, selectSidebarOpen, selectSidebarWidth, selectAccentColor } from "@/store"

/** Default accent color (neutral dark) when peacock color is not set */
const DEFAULT_ACCENT_COLOR = "#374151"

// Note: Sidebar toggle removed from UI - use Cmd+B hotkey to toggle

// Constants for sidebar width constraints
const MIN_SIDEBAR_WIDTH = 200
const MAX_SIDEBAR_WIDTH = 600

// Constants for right panel width constraints
const MIN_RIGHT_PANEL_WIDTH = 300
const MAX_RIGHT_PANEL_WIDTH = 800

// Types

export interface MainLayoutProps {
  sidebar?: React.ReactNode
  main?: React.ReactNode
  statusBar?: React.ReactNode
  header?: React.ReactNode
  showHeader?: boolean
  className?: string
  /** Optional right panel content (e.g., task chat panel) */
  rightPanel?: React.ReactNode
  /** Whether the right panel is open (defaults to false) */
  rightPanelOpen?: boolean
  /** Width of the right panel in pixels */
  rightPanelWidth?: number
  /** Callback when right panel width changes (for resize) */
  onRightPanelWidthChange?: (width: number) => void
}

export interface MainLayoutHandle {
  focusSidebar: () => void
  focusMain: () => void
  focusRightPanel: () => void
}

// MainLayout Component

/**
 * Main application layout with header, sidebar, main content area, and status bar.
 * Responsive design: sidebar collapses on mobile.
 */
export const MainLayout = forwardRef<MainLayoutHandle, MainLayoutProps>(function MainLayout(
  {
    sidebar,
    main,
    statusBar,
    header,
    showHeader = true,
    className,
    rightPanel,
    rightPanelOpen = false,
    rightPanelWidth = 400,
    onRightPanelWidthChange,
  },
  ref,
) {
  const sidebarOpen = useAppStore(selectSidebarOpen)
  const sidebarWidth = useAppStore(selectSidebarWidth)
  const setSidebarWidth = useAppStore(state => state.setSidebarWidth)
  const accentColor = useAppStore(selectAccentColor)
  const borderColor = accentColor ?? DEFAULT_ACCENT_COLOR
  const sidebarRef = useRef<HTMLDivElement>(null)
  const mainRef = useRef<HTMLDivElement>(null)
  const rightPanelRef = useRef<HTMLDivElement>(null)

  // Drag state for resizing (sidebar and right panel)
  const [isResizing, setIsResizing] = useState(false)
  const [isResizingRightPanel, setIsResizingRightPanel] = useState(false)

  // Handle mouse move during sidebar resize
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing) return
      const newWidth = Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, e.clientX))
      setSidebarWidth(newWidth)
    },
    [isResizing, setSidebarWidth],
  )

  // Handle mouse move during right panel resize
  const handleRightPanelMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizingRightPanel || !onRightPanelWidthChange) return
      const windowWidth = window.innerWidth
      const newWidth = Math.min(
        MAX_RIGHT_PANEL_WIDTH,
        Math.max(MIN_RIGHT_PANEL_WIDTH, windowWidth - e.clientX),
      )
      onRightPanelWidthChange(newWidth)
    },
    [isResizingRightPanel, onRightPanelWidthChange],
  )

  // Handle mouse up to stop resizing
  const handleMouseUp = useCallback(() => {
    setIsResizing(false)
    setIsResizingRightPanel(false)
  }, [])

  // Add/remove global mouse event listeners during sidebar resize
  useEffect(() => {
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
      // Prevent text selection during resize
      document.body.style.userSelect = "none"
      document.body.style.cursor = "col-resize"
    } else if (!isResizingRightPanel) {
      document.body.style.userSelect = ""
      document.body.style.cursor = ""
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
      if (!isResizingRightPanel) {
        document.body.style.userSelect = ""
        document.body.style.cursor = ""
      }
    }
  }, [isResizing, isResizingRightPanel, handleMouseMove, handleMouseUp])

  // Add/remove global mouse event listeners during right panel resize
  useEffect(() => {
    if (isResizingRightPanel) {
      document.addEventListener("mousemove", handleRightPanelMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
      // Prevent text selection during resize
      document.body.style.userSelect = "none"
      document.body.style.cursor = "col-resize"
    } else if (!isResizing) {
      document.body.style.userSelect = ""
      document.body.style.cursor = ""
    }

    return () => {
      document.removeEventListener("mousemove", handleRightPanelMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
      if (!isResizing) {
        document.body.style.userSelect = ""
        document.body.style.cursor = ""
      }
    }
  }, [isResizingRightPanel, isResizing, handleRightPanelMouseMove, handleMouseUp])

  // Start sidebar resizing on mouse down
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }, [])

  // Start right panel resizing on mouse down
  const handleRightPanelResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizingRightPanel(true)
  }, [])

  // Expose focus methods via ref
  useImperativeHandle(ref, () => ({
    focusSidebar: () => {
      if (sidebarRef.current) {
        // Find the first focusable element in the sidebar
        const focusable = sidebarRef.current.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        )
        focusable?.focus()
      }
    },
    focusMain: () => {
      if (mainRef.current) {
        // Find the first focusable element in main
        const focusable = mainRef.current.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        )
        focusable?.focus()
      }
    },
    focusRightPanel: () => {
      if (rightPanelRef.current) {
        // Find the first focusable element in the right panel
        const focusable = rightPanelRef.current.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        )
        focusable?.focus()
      }
    },
  }))

  return (
    <div
      className={cn("bg-background flex h-screen flex-col overflow-hidden", className)}
      style={{ border: `2px solid ${borderColor}` }}
    >
      {/* Header */}
      {showHeader && (header ?? <Header />)}

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside
          ref={sidebarRef}
          className={cn(
            "border-sidebar-border bg-sidebar relative flex flex-col border-r",
            !isResizing && "transition-all duration-200",
          )}
          style={{ width: sidebarOpen ? sidebarWidth : 0 }}
        >
          {sidebarOpen && (
            <div className="flex h-full flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto">{sidebar}</div>
            </div>
          )}

          {/* Resize handle */}
          {sidebarOpen && (
            <div
              className={cn(
                "absolute top-0 right-0 z-10 h-full w-1 cursor-col-resize transition-colors",
                "hover:bg-primary/20",
                isResizing && "bg-primary/30",
              )}
              onMouseDown={handleResizeStart}
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize sidebar"
              aria-valuenow={sidebarWidth}
              aria-valuemin={MIN_SIDEBAR_WIDTH}
              aria-valuemax={MAX_SIDEBAR_WIDTH}
            />
          )}
        </aside>

        {/* Main content */}
        <main ref={mainRef} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto">{main}</div>
          {/* Status bar - inside main panel */}
          {statusBar && (
            <footer className="border-border bg-muted/50 border-t px-4 py-2">{statusBar}</footer>
          )}
        </main>

        {/* Right panel (e.g., task chat panel) */}
        <aside
          ref={rightPanelRef}
          className={cn(
            "border-sidebar-border bg-sidebar relative flex flex-col border-l",
            !isResizingRightPanel && "transition-all duration-200",
          )}
          style={{ width: rightPanelOpen ? rightPanelWidth : 0 }}
          data-testid="right-panel"
        >
          {rightPanelOpen && (
            <div className="flex h-full flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto">{rightPanel}</div>
            </div>
          )}

          {/* Resize handle for right panel */}
          {rightPanelOpen && onRightPanelWidthChange && (
            <div
              className={cn(
                "absolute top-0 left-0 z-10 h-full w-1 cursor-col-resize transition-colors",
                "hover:bg-primary/20",
                isResizingRightPanel && "bg-primary/30",
              )}
              onMouseDown={handleRightPanelResizeStart}
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize right panel"
              aria-valuenow={rightPanelWidth}
              aria-valuemin={MIN_RIGHT_PANEL_WIDTH}
              aria-valuemax={MAX_RIGHT_PANEL_WIDTH}
            />
          )}
        </aside>
      </div>
    </div>
  )
})
