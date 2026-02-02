import { IconChecklist, IconLayoutList } from "@tabler/icons-react"
import { DemoShell } from "./components/DemoShell"

export function App() {
  return (
    <DemoShell
      title="Beads Task Manager Demo"
      subtitle="Task management UI"
      headerActions={<WorkspaceIndicator />}
      sidebar={<SidebarPlaceholder />}
      statusBar={<span>Ready</span>}
    >
      <div className="flex h-full items-center justify-center p-8">
        <div className="flex flex-col items-center gap-4 text-muted-foreground">
          <IconChecklist size={48} stroke={1.5} />
          <p className="text-center text-sm">
            Select a task from the sidebar to view details.
            <br />
            Task management UI will be implemented here.
          </p>
        </div>
      </div>
    </DemoShell>
  )
}

/** Placeholder workspace selector shown in the header */
function WorkspaceIndicator() {
  return (
    <button className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted">
      <IconLayoutList size={16} stroke={1.5} />
      Select workspace…
    </button>
  )
}

/** Placeholder sidebar showing where the task list will go */
function SidebarPlaceholder() {
  return (
    <div className="flex h-full flex-col">
      {/* Search area */}
      <div className="border-b border-border px-3 py-2">
        <div className="flex h-8 items-center rounded-md border border-border bg-muted/50 px-3 text-sm text-muted-foreground">
          Search tasks…
        </div>
      </div>

      {/* Task list placeholder */}
      <div className="flex flex-1 items-center justify-center p-4">
        <p className="text-center text-xs text-muted-foreground">Task list will appear here</p>
      </div>

      {/* Progress bar area */}
      <div className="border-t border-border px-3 py-2">
        <div className="h-1.5 rounded-full bg-muted" />
      </div>
    </div>
  )
}
