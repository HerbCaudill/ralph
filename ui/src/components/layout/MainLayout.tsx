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

// Constants for left panel width constraints
const MIN_LEFT_PANEL_WIDTH = 300
const MAX_LEFT_PANEL_WIDTH = 600

// Constants for detail panel width constraints
const MIN_DETAIL_PANEL_WIDTH = 400
const MAX_DETAIL_PANEL_WIDTH = 1800
const DEFAULT_DETAIL_PANEL_WIDTH = 1200

// Types

export interface MainLayoutProps {
  sidebar?: React.ReactNode
  main?: React.ReactNode
  statusBar?: React.ReactNode
  header?: React.ReactNode
  showHeader?: boolean
  className?: string
  /** Optional left panel content (e.g., task chat panel) */
  leftPanel?: React.ReactNode
  /** Whether the left panel is open (defaults to false) */
  leftPanelOpen?: boolean
  /** Width of the left panel in pixels */
  leftPanelWidth?: number
  /** Callback when left panel width changes (for resize) */
  onLeftPanelWidthChange?: (width: number) => void
  /** Optional right panel content (e.g., event log viewer) */
  rightPanel?: React.ReactNode
  /** Whether the right panel is open (defaults to false) */
  rightPanelOpen?: boolean
  /** Width of the right panel in pixels */
  rightPanelWidth?: number
  /** Callback when right panel width changes (for resize) */
  onRightPanelWidthChange?: (width: number) => void
  /** Optional detail panel content (slides out from sidebar over main content) */
  detailPanel?: React.ReactNode
  /** Whether the detail panel is open (defaults to false) */
  detailPanelOpen?: boolean
}

export interface MainLayoutHandle {
  focusSidebar: () => void
  focusMain: () => void
  focusLeftPanel: () => void
  focusRightPanel: () => void
  focusDetailPanel: () => void
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
    leftPanel,
    leftPanelOpen = false,
    leftPanelWidth = 400,
    onLeftPanelWidthChange,
    rightPanel,
    rightPanelOpen = false,
    rightPanelWidth = 400,
    onRightPanelWidthChange,
    detailPanel,
    detailPanelOpen = false,
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
  const leftPanelRef = useRef<HTMLDivElement>(null)
  const rightPanelRef = useRef<HTMLDivElement>(null)
  const detailPanelRef = useRef<HTMLDivElement>(null)

  // Drag state for resizing (sidebar, left panel, right panel, and detail panel)
  const [isResizing, setIsResizing] = useState(false)
  const [isResizingLeftPanel, setIsResizingLeftPanel] = useState(false)
  const [isResizingRightPanel, setIsResizingRightPanel] = useState(false)
  const [isResizingDetailPanel, setIsResizingDetailPanel] = useState(false)
  const [detailPanelWidth, setDetailPanelWidth] = useState(DEFAULT_DETAIL_PANEL_WIDTH)

  // Handle mouse move during sidebar resize
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing) return
      // Account for left panel width when calculating sidebar position
      const leftOffset = leftPanelOpen ? leftPanelWidth : 0
      const newWidth = Math.min(
        MAX_SIDEBAR_WIDTH,
        Math.max(MIN_SIDEBAR_WIDTH, e.clientX - leftOffset),
      )
      setSidebarWidth(newWidth)
    },
    [isResizing, setSidebarWidth, leftPanelOpen, leftPanelWidth],
  )

  // Handle mouse move during left panel resize
  const handleLeftPanelMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizingLeftPanel || !onLeftPanelWidthChange) return
      const newWidth = Math.min(MAX_LEFT_PANEL_WIDTH, Math.max(MIN_LEFT_PANEL_WIDTH, e.clientX))
      onLeftPanelWidthChange(newWidth)
    },
    [isResizingLeftPanel, onLeftPanelWidthChange],
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

  // Handle mouse move during detail panel resize
  const handleDetailPanelMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizingDetailPanel) return
      // Calculate the left edge position (after left panel and sidebar)
      const leftOffset = (leftPanelOpen ? leftPanelWidth : 0) + (sidebarOpen ? sidebarWidth : 0)
      const newWidth = Math.min(
        MAX_DETAIL_PANEL_WIDTH,
        Math.max(MIN_DETAIL_PANEL_WIDTH, e.clientX - leftOffset),
      )
      setDetailPanelWidth(newWidth)
    },
    [isResizingDetailPanel, leftPanelOpen, leftPanelWidth, sidebarOpen, sidebarWidth],
  )

  // Handle mouse up to stop resizing
  const handleMouseUp = useCallback(() => {
    setIsResizing(false)
    setIsResizingLeftPanel(false)
    setIsResizingRightPanel(false)
    setIsResizingDetailPanel(false)
  }, [])

  // Add/remove global mouse event listeners during sidebar resize
  useEffect(() => {
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
      // Prevent text selection during resize
      document.body.style.userSelect = "none"
      document.body.style.cursor = "col-resize"
    } else if (!isResizingLeftPanel && !isResizingRightPanel && !isResizingDetailPanel) {
      document.body.style.userSelect = ""
      document.body.style.cursor = ""
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
      if (!isResizingLeftPanel && !isResizingRightPanel && !isResizingDetailPanel) {
        document.body.style.userSelect = ""
        document.body.style.cursor = ""
      }
    }
  }, [
    isResizing,
    isResizingLeftPanel,
    isResizingRightPanel,
    isResizingDetailPanel,
    handleMouseMove,
    handleMouseUp,
  ])

  // Add/remove global mouse event listeners during left panel resize
  useEffect(() => {
    if (isResizingLeftPanel) {
      document.addEventListener("mousemove", handleLeftPanelMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
      // Prevent text selection during resize
      document.body.style.userSelect = "none"
      document.body.style.cursor = "col-resize"
    } else if (!isResizing && !isResizingRightPanel && !isResizingDetailPanel) {
      document.body.style.userSelect = ""
      document.body.style.cursor = ""
    }

    return () => {
      document.removeEventListener("mousemove", handleLeftPanelMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
      if (!isResizing && !isResizingRightPanel && !isResizingDetailPanel) {
        document.body.style.userSelect = ""
        document.body.style.cursor = ""
      }
    }
  }, [
    isResizingLeftPanel,
    isResizing,
    isResizingRightPanel,
    isResizingDetailPanel,
    handleLeftPanelMouseMove,
    handleMouseUp,
  ])

  // Add/remove global mouse event listeners during right panel resize
  useEffect(() => {
    if (isResizingRightPanel) {
      document.addEventListener("mousemove", handleRightPanelMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
      // Prevent text selection during resize
      document.body.style.userSelect = "none"
      document.body.style.cursor = "col-resize"
    } else if (!isResizing && !isResizingLeftPanel && !isResizingDetailPanel) {
      document.body.style.userSelect = ""
      document.body.style.cursor = ""
    }

    return () => {
      document.removeEventListener("mousemove", handleRightPanelMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
      if (!isResizing && !isResizingLeftPanel && !isResizingDetailPanel) {
        document.body.style.userSelect = ""
        document.body.style.cursor = ""
      }
    }
  }, [
    isResizingRightPanel,
    isResizing,
    isResizingLeftPanel,
    isResizingDetailPanel,
    handleRightPanelMouseMove,
    handleMouseUp,
  ])

  // Add/remove global mouse event listeners during detail panel resize
  useEffect(() => {
    if (isResizingDetailPanel) {
      document.addEventListener("mousemove", handleDetailPanelMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
      // Prevent text selection during resize
      document.body.style.userSelect = "none"
      document.body.style.cursor = "col-resize"
    } else if (!isResizing && !isResizingLeftPanel && !isResizingRightPanel) {
      document.body.style.userSelect = ""
      document.body.style.cursor = ""
    }

    return () => {
      document.removeEventListener("mousemove", handleDetailPanelMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
      if (!isResizing && !isResizingLeftPanel && !isResizingRightPanel) {
        document.body.style.userSelect = ""
        document.body.style.cursor = ""
      }
    }
  }, [
    isResizingDetailPanel,
    isResizing,
    isResizingLeftPanel,
    isResizingRightPanel,
    handleDetailPanelMouseMove,
    handleMouseUp,
  ])

  // Start sidebar resizing on mouse down
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }, [])

  // Start left panel resizing on mouse down
  const handleLeftPanelResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizingLeftPanel(true)
  }, [])

  // Start right panel resizing on mouse down
  const handleRightPanelResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizingRightPanel(true)
  }, [])

  // Start detail panel resizing on mouse down
  const handleDetailPanelResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizingDetailPanel(true)
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
    focusLeftPanel: () => {
      if (leftPanelRef.current) {
        // Find the first focusable element in the left panel
        const focusable = leftPanelRef.current.querySelector<HTMLElement>(
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
    focusDetailPanel: () => {
      if (detailPanelRef.current) {
        // Find the first focusable element in the detail panel
        const focusable = detailPanelRef.current.querySelector<HTMLElement>(
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
        {/* Left panel (e.g., task chat panel) */}
        <aside
          ref={leftPanelRef}
          className={cn(
            "border-sidebar-border bg-sidebar relative flex flex-col border-r",
            !isResizingLeftPanel && "transition-all duration-200",
          )}
          style={{ width: leftPanelOpen ? leftPanelWidth : 0 }}
          data-testid="left-panel"
        >
          {leftPanelOpen && (
            <div className="flex h-full flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto">{leftPanel}</div>
            </div>
          )}

          {/* Resize handle for left panel */}
          {leftPanelOpen && onLeftPanelWidthChange && (
            <div
              className={cn(
                "absolute top-0 right-0 z-10 h-full w-1 cursor-col-resize transition-colors",
                "hover:bg-primary/20",
                isResizingLeftPanel && "bg-primary/30",
              )}
              onMouseDown={handleLeftPanelResizeStart}
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize left panel"
              aria-valuenow={leftPanelWidth}
              aria-valuemin={MIN_LEFT_PANEL_WIDTH}
              aria-valuemax={MAX_LEFT_PANEL_WIDTH}
            />
          )}
        </aside>

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

        {/* Main content with detail panel overlay */}
        <main ref={mainRef} className="relative flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto">{main}</div>
          {/* Status bar - inside main panel */}
          {statusBar && (
            <footer className="border-border bg-muted/50 border-t px-4 py-2">{statusBar}</footer>
          )}

          {/* Detail panel - slides out from left edge of main content, overlapping it */}
          {detailPanel && (
            <aside
              ref={detailPanelRef}
              className={cn(
                "bg-background border-border absolute inset-y-0 left-0 z-20 flex flex-col overflow-hidden border-r shadow-lg",
                "transition-all duration-200 ease-in-out",
              )}
              style={{
                width: detailPanelOpen ? detailPanelWidth : 0,
                opacity: detailPanelOpen ? 1 : 0,
              }}
              data-testid="detail-panel"
            >
              {detailPanelOpen && (
                <div className="flex h-full flex-col overflow-hidden">{detailPanel}</div>
              )}

              {/* Resize handle for detail panel */}
              {detailPanelOpen && (
                <div
                  className={cn(
                    "absolute top-0 right-0 z-10 h-full w-1 cursor-col-resize transition-colors",
                    "hover:bg-primary/20",
                    isResizingDetailPanel && "bg-primary/30",
                  )}
                  onMouseDown={handleDetailPanelResizeStart}
                  role="separator"
                  aria-orientation="vertical"
                  aria-label="Resize detail panel"
                  aria-valuenow={detailPanelWidth}
                  aria-valuemin={MIN_DETAIL_PANEL_WIDTH}
                  aria-valuemax={MAX_DETAIL_PANEL_WIDTH}
                />
              )}
            </aside>
          )}
        </main>

        {/* Right panel (e.g., event log viewer) */}
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
