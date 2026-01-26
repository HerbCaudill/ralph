import { useState, useCallback, useEffect, useRef, useMemo } from "react"
import { useAppStore, selectIssuePrefix, selectTasks } from "@/store"
import type { TaskCardTask, TaskStatus, TaskUpdateData } from "@/types"
import { linkSessionToTask } from "@/lib/saveEventLogAndAddComment"

// Types

export type IssueType = "task" | "bug" | "epic"

export interface UseTaskDetailsOptions {
  /** The task to edit */
  task: TaskCardTask | null
  /** Whether the dialog is open */
  open: boolean
  /** Whether the dialog is in read-only mode */
  readOnly?: boolean
  /** Callback when save is triggered */
  onSave?: (id: string, updates: TaskUpdateData) => void | Promise<void>
  /** Callback when delete is triggered */
  onDelete?: (id: string) => void | Promise<void>
  /** Callback when close is triggered */
  onClose: () => void
  /** Current session ID for linking to tasks when closed (optional) */
  currentSessionId?: string | null
}

export interface TaskFormValues {
  title: string
  description: string
  status: TaskStatus
  priority: number
  issueType: IssueType
  parent: string | null
}

export interface UseTaskDetailsResult {
  // Form values
  formValues: TaskFormValues
  labels: string[]

  // Derived data from store
  issuePrefix: string | null
  allTasks: TaskCardTask[]

  // Loading states
  isSaving: boolean
  isDeleting: boolean
  isAddingLabel: boolean

  // Delete confirmation state
  isConfirmingDelete: boolean
  deleteError: string | null

  // Label input state
  newLabel: string
  showLabelInput: boolean

  // Handlers - field updates
  updateTitle: (title: string) => void
  updateDescription: (description: string) => void
  updateStatus: (status: TaskStatus) => void
  updatePriority: (priority: number) => void
  updateIssueType: (issueType: IssueType) => void
  updateParent: (parent: string | null) => void

  // Handlers - label management
  setNewLabel: (label: string) => void
  setShowLabelInput: (show: boolean) => void
  handleAddLabel: () => Promise<void>
  handleRemoveLabel: (label: string) => Promise<void>

  // Handlers - delete
  startDelete: () => void
  cancelDelete: () => void
  confirmDelete: () => Promise<void>

  // Handlers - close
  handleClose: () => Promise<void>
}

// Hook implementation

/**
 * Hook to manage task details form state and API interactions.
 *
 * Encapsulates all business logic for editing task details including:
 * - Form state management with autosave
 * - Label CRUD operations
 * - Delete confirmation flow
 * - Event log capture on close
 */
export function useTaskDetails({
  task,
  open,
  readOnly = false,
  onSave,
  onDelete,
  onClose,
  currentSessionId,
}: UseTaskDetailsOptions): UseTaskDetailsResult {
  // Store access
  const issuePrefix = useAppStore(selectIssuePrefix)
  const allTasks = useAppStore(selectTasks)

  // Form state
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [status, setStatus] = useState<TaskStatus>("open")
  const [priority, setPriority] = useState<number>(2)
  const [issueType, setIssueType] = useState<IssueType>("task")
  const [parent, setParent] = useState<string | null>(null)

  // Loading states
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isAddingLabel, setIsAddingLabel] = useState(false)

  // Delete state
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Label state
  const [labels, setLabels] = useState<string[]>([])
  const [newLabel, setNewLabel] = useState("")
  const [showLabelInput, setShowLabelInput] = useState(false)

  // Track last saved values to detect changes
  const lastSavedRef = useRef<TaskFormValues | null>(null)

  // Debounce timer ref for text field autosave
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Fetch labels when task changes
  useEffect(() => {
    if (task && open) {
      fetch(`/api/tasks/${task.id}/labels`)
        .then(res => res.json())
        .then((data: { ok: boolean; labels?: string[] }) => {
          if (data.ok && data.labels) {
            setLabels(data.labels)
          }
        })
        .catch(err => {
          console.error("Failed to fetch labels:", err)
        })
    }
  }, [task, open])

  // Reset local state when task changes
  useEffect(() => {
    if (task) {
      const initialValues: TaskFormValues = {
        title: task.title,
        description: task.description ?? "",
        status: task.status,
        priority: task.priority ?? 2,
        issueType: (task.issue_type as IssueType) ?? "task",
        parent: task.parent ?? null,
      }
      setTitle(initialValues.title)
      setDescription(initialValues.description)
      setStatus(initialValues.status)
      setPriority(initialValues.priority)
      setIssueType(initialValues.issueType)
      setParent(initialValues.parent)
      setLabels(task.labels ?? [])
      setNewLabel("")
      setShowLabelInput(false)
      setIsConfirmingDelete(false)
      setIsDeleting(false)
      setDeleteError(null)
      lastSavedRef.current = initialValues
    }
  }, [task])

  // Cleanup autosave timer on unmount
  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current)
      }
    }
  }, [])

  // Current form values
  const formValues = useMemo(
    () => ({
      title,
      description,
      status,
      priority,
      issueType,
      parent,
    }),
    [title, description, status, priority, issueType, parent],
  )

  // Saves only the fields that have changed since last save
  const performAutosave = useCallback(
    async (currentValues: TaskFormValues) => {
      if (!task || !onSave || readOnly) return

      const lastSaved = lastSavedRef.current
      if (!lastSaved) return

      const updates: TaskUpdateData = {}
      if (currentValues.title !== lastSaved.title) updates.title = currentValues.title
      if (currentValues.description !== lastSaved.description)
        updates.description = currentValues.description
      if (currentValues.status !== lastSaved.status) updates.status = currentValues.status
      if (currentValues.priority !== lastSaved.priority) updates.priority = currentValues.priority
      if (currentValues.issueType !== lastSaved.issueType) updates.type = currentValues.issueType
      if (currentValues.parent !== lastSaved.parent) updates.parent = currentValues.parent

      if (Object.keys(updates).length === 0) return

      setIsSaving(true)
      try {
        // If closing the task (status changed to closed), link the current session
        const isClosing = currentValues.status === "closed" && lastSaved.status !== "closed"
        if (isClosing) {
          await linkSessionToTask(task.id, currentSessionId ?? null)
        }

        await onSave(task.id, updates)
        // Update last saved values
        lastSavedRef.current = { ...currentValues }
      } catch (error) {
        console.error("Failed to autosave task:", error)
      } finally {
        setIsSaving(false)
      }
    },
    [task, onSave, readOnly, currentSessionId],
  )

  // Schedules an autosave with a 500ms debounce
  const scheduleAutosave = useCallback(
    (currentValues: TaskFormValues) => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current)
      }
      autosaveTimerRef.current = setTimeout(() => {
        performAutosave(currentValues)
      }, 500)
    },
    [performAutosave],
  )

  // Immediately autosaves for non-text fields
  const immediateAutosave = useCallback(
    (currentValues: TaskFormValues) => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current)
      }
      performAutosave(currentValues)
    },
    [performAutosave],
  )

  // Field update handlers
  const updateTitle = useCallback(
    (newTitle: string) => {
      setTitle(newTitle)
      scheduleAutosave({ ...formValues, title: newTitle })
    },
    [formValues, scheduleAutosave],
  )

  const updateDescription = useCallback(
    (newDescription: string) => {
      setDescription(newDescription)
      scheduleAutosave({ ...formValues, description: newDescription })
    },
    [formValues, scheduleAutosave],
  )

  const updateStatus = useCallback(
    (newStatus: TaskStatus) => {
      setStatus(newStatus)
      immediateAutosave({ ...formValues, status: newStatus })
    },
    [formValues, immediateAutosave],
  )

  const updatePriority = useCallback(
    (newPriority: number) => {
      setPriority(newPriority)
      immediateAutosave({ ...formValues, priority: newPriority })
    },
    [formValues, immediateAutosave],
  )

  const updateIssueType = useCallback(
    (newIssueType: IssueType) => {
      setIssueType(newIssueType)
      immediateAutosave({ ...formValues, issueType: newIssueType })
    },
    [formValues, immediateAutosave],
  )

  const updateParent = useCallback(
    (newParent: string | null) => {
      setParent(newParent)
      immediateAutosave({ ...formValues, parent: newParent })
    },
    [formValues, immediateAutosave],
  )

  // Flushes any pending autosave before closing
  const flushAndClose = useCallback(async () => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current)
      autosaveTimerRef.current = null
    }
    // Perform final save with current values
    await performAutosave(formValues)
    onClose()
  }, [performAutosave, formValues, onClose])

  // Close handler
  const handleClose = useCallback(async () => {
    setIsConfirmingDelete(false)
    await flushAndClose()
  }, [flushAndClose])

  // Delete handlers
  const startDelete = useCallback(() => {
    setDeleteError(null)
    setIsConfirmingDelete(true)
  }, [])

  const cancelDelete = useCallback(() => {
    setIsConfirmingDelete(false)
  }, [])

  const confirmDelete = useCallback(async () => {
    if (!task || !onDelete || readOnly) return

    setIsDeleting(true)
    setDeleteError(null)
    try {
      await onDelete(task.id)
      onClose()
    } catch (error) {
      console.error("Failed to delete task:", error)
      const message = error instanceof Error ? error.message : "Failed to delete task"
      setDeleteError(message)
      setIsConfirmingDelete(false)
    } finally {
      setIsDeleting(false)
    }
  }, [task, onDelete, readOnly, onClose])

  // Label handlers
  const handleAddLabel = useCallback(async () => {
    if (!task || !newLabel.trim() || readOnly) return

    const labelToAdd = newLabel.trim()
    setIsAddingLabel(true)

    try {
      const response = await fetch(`/api/tasks/${task.id}/labels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: labelToAdd }),
      })

      const data = (await response.json()) as { ok: boolean }
      if (data.ok) {
        setLabels(prev => (prev.includes(labelToAdd) ? prev : [...prev, labelToAdd]))
        setNewLabel("")
        setShowLabelInput(false)
      }
    } catch (err) {
      console.error("Failed to add label:", err)
    } finally {
      setIsAddingLabel(false)
    }
  }, [task, newLabel, readOnly])

  const handleRemoveLabel = useCallback(
    async (labelToRemove: string) => {
      if (!task || readOnly) return

      // Optimistically remove the label
      setLabels(prev => prev.filter(l => l !== labelToRemove))

      try {
        const response = await fetch(
          `/api/tasks/${task.id}/labels/${encodeURIComponent(labelToRemove)}`,
          { method: "DELETE" },
        )

        const data = (await response.json()) as { ok: boolean }
        if (!data.ok) {
          // Revert on failure
          setLabels(prev => [...prev, labelToRemove])
        }
      } catch (err) {
        console.error("Failed to remove label:", err)
        // Revert on error
        setLabels(prev => [...prev, labelToRemove])
      }
    },
    [task, readOnly],
  )

  return {
    // Form values
    formValues,
    labels,

    // Derived data
    issuePrefix,
    allTasks,

    // Loading states
    isSaving,
    isDeleting,
    isAddingLabel,

    // Delete state
    isConfirmingDelete,
    deleteError,

    // Label state
    newLabel,
    showLabelInput,

    // Field update handlers
    updateTitle,
    updateDescription,
    updateStatus,
    updatePriority,
    updateIssueType,
    updateParent,

    // Label handlers
    setNewLabel,
    setShowLabelInput,
    handleAddLabel,
    handleRemoveLabel,

    // Delete handlers
    startDelete,
    cancelDelete,
    confirmDelete,

    // Close handler
    handleClose,
  }
}
