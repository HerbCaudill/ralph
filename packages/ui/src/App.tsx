import { useState } from "react"
import { IconLoader2 } from "@tabler/icons-react"

/**
 * Main Ralph UI application.
 * Composes the task sidebar, Ralph runner, and task chat panel.
 *
 * Note: This is a placeholder that will be updated once the component
 * subagents complete their work.
 */
export function App() {
  const [isLoading] = useState(true)

  // Placeholder until components are ready
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 text-muted-foreground">
          <IconLoader2 size={48} className="animate-spin" />
          <p className="text-sm">Ralph UI - Coming Soon</p>
          <p className="text-xs">Components being created...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Main content will be added once components are ready */}
    </div>
  )
}
