import type { ReactNode } from "react"

export type DemoShellProps = {
  /** App title shown in the header */
  title: string
  /** Subtitle/description shown next to title */
  subtitle?: string
  /** Optional content rendered in the header's right side */
  headerActions?: ReactNode
  /** Optional sidebar content (left panel) */
  sidebar?: ReactNode
  /** Width of the sidebar in pixels (default: 320) */
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
  sidebarWidth = 320,
  children,
  statusBar,
}: DemoShellProps) {
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
          <aside
            className="shrink-0 overflow-hidden border-r border-border"
            style={{ width: sidebarWidth }}
          >
            {sidebar}
          </aside>
        )}
        <main className="min-h-0 min-w-0 flex-1 overflow-hidden">{children}</main>
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
