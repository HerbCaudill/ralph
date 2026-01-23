import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useCallback,
  useState,
  useEffect,
  useMemo,
} from "react"
import { cn } from "@/lib/utils"
import { Header } from "./Header"
import { useAppStore, selectSidebarOpen, selectSidebarWidth, selectAccentColor } from "@/store"
import { DEFAULT_ACCENT_COLOR } from "@/constants"
import { getContrastingColor } from "@/lib/getContrastingColor"

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
    onDetailPanelClose,
  },
  ref,
) {
  const sidebarOpen = useAppStore(selectSidebarOpen)
  const sidebarWidth = useAppStore(selectSidebarWidth)
  const setSidebarWidth = useAppStore(state => state.setSidebarWidth)
  const accentColor = useAppStore(selectAccentColor)
  const borderColor = accentColor ?? DEFAULT_ACCENT_COLOR
  const accentForeground = useMemo(() => getContrastingColor(borderColor), [borderColor])
  const sidebarRef = useRef<HTMLElement>(null)
  const mainRef = useRef<HTMLDivElement>(null)
  const leftPanelRef = useRef<HTMLDivElement>(null)
  const rightPanelRef = useRef<HTMLDivElement>(null)
  const detailPanelRef = useRef<HTMLDivElement>(null)

  const [isResizing, setIsResizing] = useState(false)
  const [isResizingLeftPanel, setIsResizingLeftPanel] = useState(false)
  const [isResizingRightPanel, setIsResizingRightPanel] = useState(false)
  const [mainWidth, setMainWidth] = useState(0)

  const detailPanelWidth = Math.min(MAX_DETAIL_PANEL_WIDTH, mainWidth - MIN_RIGHT_MARGIN)

  useEffect(() => {
    const mainElement = mainRef.current
    if (!mainElement) return

    const updateWidth = () => {
      setMainWidth(mainElement.clientWidth)
    }

    updateWidth()

    const resizeObserver = new ResizeObserver(updateWidth)
    resizeObserver.observe(mainElement)

    return () => {
      resizeObserver.disconnect()
    }
  }, [])

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing) return
      const leftOffset = leftPanelOpen ? leftPanelWidth : 0
      const newWidth = Math.min(
        MAX_SIDEBAR_WIDTH,
        Math.max(MIN_SIDEBAR_WIDTH, e.clientX - leftOffset),
      )
      setSidebarWidth(newWidth)
    },
    [isResizing, setSidebarWidth, leftPanelOpen, leftPanelWidth],
  )

  const handleLeftPanelMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizingLeftPanel || !onLeftPanelWidthChange) return
      const newWidth = Math.min(MAX_LEFT_PANEL_WIDTH, Math.max(MIN_LEFT_PANEL_WIDTH, e.clientX))
      onLeftPanelWidthChange(newWidth)
    },
    [isResizingLeftPanel, onLeftPanelWidthChange],
  )

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

  const handleMouseUp = useCallback(() => {
    setIsResizing(false)
    setIsResizingLeftPanel(false)
    setIsResizingRightPanel(false)
  }, [])

  useEffect(() => {
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
      document.body.style.userSelect = "none"
      document.body.style.cursor = "col-resize"
    } else if (!isResizingLeftPanel && !isResizingRightPanel) {
      document.body.style.userSelect = ""
      document.body.style.cursor = ""
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }
  }, [isResizing, isResizingLeftPanel, isResizingRightPanel, handleMouseMove, handleMouseUp])

  useEffect(() => {
    if (isResizingLeftPanel) {
      document.addEventListener("mousemove", handleLeftPanelMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
      document.body.style.userSelect = "none"
      document.body.style.cursor = "col-resize"
    }

    return () => {
      document.removeEventListener("mousemove", handleLeftPanelMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }
  }, [isResizingLeftPanel, handleLeftPanelMouseMove, handleMouseUp])

  useEffect(() => {
    if (isResizingRightPanel) {
      document.addEventListener("mousemove", handleRightPanelMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
      document.body.style.userSelect = "none"
      document.body.style.cursor = "col-resize"
    }

    return () => {
      document.removeEventListener("mousemove", handleRightPanelMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }
  }, [isResizingRightPanel, handleRightPanelMouseMove, handleMouseUp])

  useEffect(() => {
    if (!detailPanelOpen || !onDetailPanelClose) return

    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target) return
      if (detailPanelRef.current?.contains(target)) return
      if (target.closest("[data-radix-popper-content-wrapper]")) return
      onDetailPanelClose()
    }

    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleOutsideClick)
    }, 100)

    return () => {
      clearTimeout(timer)
      document.removeEventListener("mousedown", handleOutsideClick)
    }
  }, [detailPanelOpen, onDetailPanelClose])

  // Utility function to focus the first focusable element within a container
  const focusFirstFocusable = (container: HTMLElement | null) => {
    if (!container) return
    const focusable = container.querySelector<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )
    if (focusable) {
      focusable.focus()
    } else {
      container.focus()
    }
  }

  useImperativeHandle(ref, () => ({
    focusSidebar: () => focusFirstFocusable(sidebarRef.current),
    focusMain: () => focusFirstFocusable(mainRef.current),
    focusLeftPanel: () => focusFirstFocusable(leftPanelRef.current),
    focusRightPanel: () => focusFirstFocusable(rightPanelRef.current),
    focusDetailPanel: () => focusFirstFocusable(detailPanelRef.current),
  }))

  return (
    <div
      className={cn("flex h-screen w-screen flex-col overflow-hidden", className)}
      style={
        {
          border: `6px solid ${borderColor}`,
          borderBottomLeftRadius: "20px",
          borderBottomRightRadius: "20px",
          // Set CSS custom properties for accent color and its contrasting foreground
          "--repo-accent": borderColor,
          "--repo-accent-foreground": accentForeground,
        } as React.CSSProperties
      }
    >
      {showHeader && (header || <Header />)}
      <div className="flex flex-1 overflow-hidden">
        {leftPanel && (
          <div
            ref={leftPanelRef}
            className={cn(
              "bg-background border-sidebar-border relative flex h-full flex-col overflow-hidden border-r",
              leftPanelOpen ? "visible" : "hidden",
            )}
            style={{ width: leftPanelOpen ? leftPanelWidth : 0 }}
            tabIndex={-1}
            data-testid="left-panel"
          >
            {leftPanelOpen && leftPanel}
            {leftPanelOpen && onLeftPanelWidthChange && (
              <div
                className="bg-border absolute top-0 right-0 h-full w-1 cursor-col-resize hover:w-2"
                onMouseDown={() => setIsResizingLeftPanel(true)}
                aria-label="Resize left panel"
                role="separator"
                aria-orientation="vertical"
              />
            )}
          </div>
        )}

        {sidebar && sidebarOpen && (
          <aside
            ref={sidebarRef}
            className={cn(
              "bg-background border-sidebar-border relative flex h-full flex-col overflow-hidden border-r",
            )}
            style={{ width: sidebarWidth }}
            tabIndex={-1}
          >
            {sidebar}
            <div
              className="bg-border absolute top-0 right-0 h-full w-1 cursor-col-resize hover:w-2"
              onMouseDown={() => setIsResizing(true)}
              aria-label="Resize sidebar"
              role="separator"
              aria-orientation="vertical"
            />
          </aside>
        )}

        <div
          ref={mainRef}
          className="relative flex min-w-0 flex-1 flex-col overflow-hidden"
          tabIndex={-1}
        >
          {main}
          {statusBar && <div className="border-sidebar-border border-t px-4 py-2">{statusBar}</div>}

          {detailPanel && detailPanelOpen && (
            <div
              ref={detailPanelRef}
              className="bg-background border-sidebar-border absolute left-0 h-full overflow-hidden border-r shadow-lg"
              style={{ width: detailPanelWidth }}
              tabIndex={-1}
              onClick={e => e.stopPropagation()}
            >
              {detailPanel}
            </div>
          )}
        </div>

        {rightPanel && (
          <div
            ref={rightPanelRef}
            className={cn(
              "bg-background border-sidebar-border relative flex h-full flex-col overflow-hidden border-l",
              rightPanelOpen ? "visible" : "hidden",
            )}
            style={{ width: rightPanelOpen ? rightPanelWidth : 0 }}
            tabIndex={-1}
            data-testid="right-panel"
          >
            {rightPanelOpen && onRightPanelWidthChange && (
              <div
                className="bg-border absolute top-0 left-0 h-full w-1 cursor-col-resize hover:w-2"
                onMouseDown={() => setIsResizingRightPanel(true)}
                aria-label="Resize right panel"
                role="separator"
                aria-orientation="vertical"
              />
            )}
            {rightPanelOpen && rightPanel}
          </div>
        )}
      </div>
    </div>
  )
})

/**
 * Minimum width for the sidebar in pixels
 */
const MIN_SIDEBAR_WIDTH = 200

/**
 * Maximum width for the sidebar in pixels
 */
const MAX_SIDEBAR_WIDTH = 600

/**
 * Minimum width for the right panel in pixels
 */
const MIN_RIGHT_PANEL_WIDTH = 300

/**
 * Maximum width for the right panel in pixels
 */
const MAX_RIGHT_PANEL_WIDTH = 800

/**
 * Minimum width for the left panel in pixels
 */
const MIN_LEFT_PANEL_WIDTH = 300

/**
 * Maximum width for the left panel in pixels
 */
const MAX_LEFT_PANEL_WIDTH = 600

/**
 * Maximum width for the detail panel in pixels
 */
const MAX_DETAIL_PANEL_WIDTH = 800

/**
 * Minimum right margin when detail panel is open, in pixels
 */
const MIN_RIGHT_MARGIN = 200

export type MainLayoutProps = {
  sidebar?: React.ReactNode
  main?: React.ReactNode
  statusBar?: React.ReactNode
  header?: React.ReactNode
  showHeader?: boolean
  className?: string
  leftPanel?: React.ReactNode
  leftPanelOpen?: boolean
  leftPanelWidth?: number
  onLeftPanelWidthChange?: (width: number) => void
  rightPanel?: React.ReactNode
  rightPanelOpen?: boolean
  rightPanelWidth?: number
  onRightPanelWidthChange?: (width: number) => void
  detailPanel?: React.ReactNode
  detailPanelOpen?: boolean
  onDetailPanelClose?: () => void
}

export type MainLayoutHandle = {
  focusSidebar: () => void
  focusMain: () => void
  focusLeftPanel: () => void
  focusRightPanel: () => void
  focusDetailPanel: () => void
}
