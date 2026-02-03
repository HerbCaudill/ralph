import type { ReactNode } from "react"
import { Group, Panel, Separator } from "react-resizable-panels"
import { cn } from "../lib/utils"

/**
 * Main application layout with three resizable panels:
 * - Left sidebar (resizable, min 10%, max 25%, default 20%)
 * - Center panel (main content, flexible)
 * - Right panel (optional, resizable, min 15%, max 50%, default 30%)
 *
 * Uses react-resizable-panels for all resize functionality.
 */
export function MainLayout({ sidebar, rightPanel, children }: MainLayoutProps) {
  return (
    <Group orientation="horizontal" className="h-screen w-screen overflow-hidden">
      {/* Left sidebar */}
      {sidebar && (
        <>
          <Panel
            defaultSize={DEFAULT_SIDEBAR_PERCENT}
            minSize={MIN_SIDEBAR_PERCENT}
            maxSize={MAX_SIDEBAR_PERCENT}
          >
            <aside className="bg-background flex h-full flex-col overflow-hidden border-r border-border">
              {sidebar}
            </aside>
          </Panel>
          <Separator
            className={cn(
              "w-1 cursor-col-resize transition-colors",
              "hover:bg-primary/20 hover:w-2",
              "data-[resize-handle-state=drag]:bg-primary/30 data-[resize-handle-state=drag]:w-2",
            )}
            data-testid="sidebar-resize-handle"
          />
        </>
      )}

      {/* Center panel */}
      <Panel minSize={0}>
        <main className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">{children}</main>
      </Panel>

      {/* Right panel */}
      {rightPanel && (
        <>
          <Separator
            className={cn(
              "w-1 cursor-col-resize transition-colors",
              "hover:bg-primary/20 hover:w-2",
              "data-[resize-handle-state=drag]:bg-primary/30 data-[resize-handle-state=drag]:w-2",
            )}
            data-testid="right-panel-resize-handle"
          />
          <Panel
            defaultSize={DEFAULT_RIGHT_PANEL_PERCENT}
            minSize={MIN_RIGHT_PANEL_PERCENT}
            maxSize={MAX_RIGHT_PANEL_PERCENT}
          >
            <aside className="bg-background flex h-full flex-col overflow-hidden border-l border-border">
              {rightPanel}
            </aside>
          </Panel>
        </>
      )}
    </Group>
  )
}

/** Minimum width for the sidebar as percentage. */
const MIN_SIDEBAR_PERCENT = 5

/** Maximum width for the sidebar as percentage. */
const MAX_SIDEBAR_PERCENT = 50

/** Default width for the sidebar as percentage. */
const DEFAULT_SIDEBAR_PERCENT = 25

/** Minimum width for the right panel as percentage. */
const MIN_RIGHT_PANEL_PERCENT = 10

/** Maximum width for the right panel as percentage. */
const MAX_RIGHT_PANEL_PERCENT = 70

/** Default width for the right panel as percentage. */
const DEFAULT_RIGHT_PANEL_PERCENT = 35

export type MainLayoutProps = {
  /** Optional sidebar content (left panel, resizable). */
  sidebar?: ReactNode
  /** Optional right panel content (toggleable). */
  rightPanel?: ReactNode
  /** Main content area (center panel). */
  children: ReactNode
}
