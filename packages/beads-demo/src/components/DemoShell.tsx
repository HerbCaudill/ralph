import { useCallback, useRef, useState, type ReactNode } from "react"

/** Minimum sidebar width in pixels. */
const MIN_SIDEBAR_WIDTH = 200

/** Maximum sidebar width in pixels. */
const MAX_SIDEBAR_WIDTH = 600

export type DemoShellProps = {
  /** App title shown in the header */
  title: string
  /** Subtitle/description shown next to title */
  subtitle?: string
  /** Optional content rendered in the header's right side */
  headerActions?: ReactNode
  /** Optional sidebar content (left panel) */
  sidebar?: ReactNode
  /** Initial width of the sidebar in pixels (default: 320) */
  sidebarWidth?: number
  /** Main content area */
  children: ReactNode
  /** Optional status bar at the bottom */
  statusBar?: ReactNode
}

/**
 * Shared demo shell layout providing header, optional sidebar, main content, and status bar.
 * Uses IBM Plex fonts and Tabler icon defaults from the project theme.
 */
export function DemoShell({
  title,
  subtitle,
  headerActions,
  sidebar,
  sidebarWidth: initialWidth = 320,
  children,
  statusBar,
}: DemoShellProps) {
  const [sidebarWidth, setSidebarWidth] = useState(initialWidth)
  const isDragging = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(0)

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      isDragging.current = true
      startX.current = e.clientX
      startWidth.current = sidebarWidth

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!isDragging.current) return
        const delta = moveEvent.clientX - startX.current
        const newWidth = Math.min(
          MAX_SIDEBAR_WIDTH,
          Math.max(MIN_SIDEBAR_WIDTH, startWidth.current + delta),
        )
        setSidebarWidth(newWidth)
      }

      const handleMouseUp = () => {
        isDragging.current = false
        document.removeEventListener("mousemove", handleMouseMove)
        document.removeEventListener("mouseup", handleMouseUp)
        document.body.style.cursor = ""
        document.body.style.userSelect = ""
      }

      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
      document.body.style.cursor = "col-resize"
      document.body.style.userSelect = "none"
    },
    [sidebarWidth],
  )

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Header */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-3">
          <h1 className="font-sans text-base font-semibold">{title}</h1>
          {subtitle && <span className="text-sm text-muted-foreground">{subtitle}</span>}
        </div>
        {headerActions && <div className="flex items-center gap-2">{headerActions}</div>}
      </header>

      {/* Body: sidebar + main */}
      <div className="flex min-h-0 flex-1">
        {sidebar && (
          <aside className="relative shrink-0 overflow-hidden" style={{ width: sidebarWidth }}>
            {sidebar}
            {/* Resize handle */}
            <div
              className="absolute right-0 top-0 z-10 h-full w-1 cursor-col-resize bg-transparent transition-colors hover:bg-primary/30"
              onMouseDown={handleMouseDown}
              role="separator"
              aria-orientation="vertical"
              aria-valuenow={sidebarWidth}
              aria-valuemin={MIN_SIDEBAR_WIDTH}
              aria-valuemax={MAX_SIDEBAR_WIDTH}
            />
          </aside>
        )}
        <main className="min-h-0 min-w-0 flex-1 overflow-hidden border-l border-border">
          {children}
        </main>
      </div>

      {/* Status bar */}
      {statusBar && (
        <footer className="flex h-8 shrink-0 items-center border-t border-border px-4 text-xs text-muted-foreground">
          {statusBar}
        </footer>
      )}
    </div>
  )
}
