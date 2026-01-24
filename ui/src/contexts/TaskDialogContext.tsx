import { createContext, useContext, type ReactNode } from "react"

// Types

export interface TaskDialogContextValue {
  /** Open task details dialog by task ID */
  openTaskById: (id: string) => void
}

// Context

const TaskDialogContext = createContext<TaskDialogContextValue | null>(null)

// Provider

export interface TaskDialogProviderProps {
  children: ReactNode
  openTaskById: (id: string) => void
}

export function TaskDialogProvider({ children, openTaskById }: TaskDialogProviderProps) {
  return (
    <TaskDialogContext.Provider value={{ openTaskById }}>{children}</TaskDialogContext.Provider>
  )
}

// Hook

export function useTaskDialogContext(): TaskDialogContextValue | null {
  return useContext(TaskDialogContext)
}
