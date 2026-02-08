import { useState, useCallback, useEffect, useRef, useMemo } from "react"
import { useBeadsViewStore, selectIssuePrefix, selectTasks } from "../store"
import { linkSessionToTask } from "../lib/linkSessionToTask"
import { apiFetch } from "../lib/apiClient"
import type { Task, TaskStatus, TaskUpdateData, Comment } from "../types"

/**
 * Hook to manage task details form state and API interactions.
 */
export function useTaskDetails(
  /** Task details configuration. */
  options: UseTaskDetailsOptions,
): UseTaskDetailsResult {
  const { task, open, readOnly = false, onSave, onDelete, onClose, currentSessionId } = options

  const issuePrefix = useBeadsViewStore(selectIssuePrefix)
  const allTasks = useBeadsViewStore(selectTasks)

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [status, setStatus] = useState<TaskStatus>("open")
  const [priority, setPriority] = useState<number>(2)
  const [issueType, setIssueType] = useState<IssueType>("task")
  const [parent, setParent] = useState<string | null>(null)

  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isAddingLabel, setIsAddingLabel] = useState(false)

  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const [labels, setLabels] = useState<string[]>([])
  const [newLabel, setNewLabel] = useState("")
  const [showLabelInput, setShowLabelInput] = useState(false)

  const [comments, setComments] = useState<Comment[]>([])
  const [isLoadingComments, setIsLoadingComments] = useState(false)
  const [commentsError, setCommentsError] = useState<string | null>(null)

  const lastSavedRef = useRef<TaskFormValues | null>(null)
  const lastTaskIdRef = useRef<string | null>(null)
  const wasOpenRef = useRef(false)
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (task && open) {
      apiFetch(`/api/tasks/${task.id}/labels`)
        .then(res => res.json())
        .then((data: { ok: boolean; labels?: string[] }) => {
          if (data.ok && data.labels) {
            setLabels(data.labels)
          }
        })
        .catch(err => {
          console.error("Failed to fetch labels:", err)
        })

      setIsLoadingComments(true)
      setCommentsError(null)
      apiFetch(`/api/tasks/${task.id}/comments`)
        .then(res => res.json())
        .then((data: { ok: boolean; comments?: Comment[]; error?: string }) => {
          if (data.ok && data.comments) {
            setComments(data.comments)
          } else {
            setCommentsError(data.error || "Failed to load comments")
          }
        })
        .catch(err => {
          console.error("Failed to fetch comments:", err)
          setCommentsError(err instanceof Error ? err.message : "Failed to load comments")
        })
        .finally(() => {
          setIsLoadingComments(false)
        })
    }
  }, [task, open])

  useEffect(() => {
    const taskId = task?.id ?? null
    const isOpening = open && !wasOpenRef.current
    const isTaskChange = taskId !== lastTaskIdRef.current

    lastTaskIdRef.current = taskId
    wasOpenRef.current = open

    if (task && (isTaskChange || isOpening)) {
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
  }, [task, open])

  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current)
      }
    }
  }, [])

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
        const isClosing = currentValues.status === "closed" && lastSaved.status !== "closed"
        if (isClosing) {
          await linkSessionToTask(task.id, currentSessionId ?? null)
        }

        await onSave(task.id, updates)
        lastSavedRef.current = { ...currentValues }
      } catch (error) {
        console.error("Failed to autosave task:", error)
      } finally {
        setIsSaving(false)
      }
    },
    [task, onSave, readOnly, currentSessionId],
  )

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

  const immediateAutosave = useCallback(
    (currentValues: TaskFormValues) => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current)
      }
      performAutosave(currentValues)
    },
    [performAutosave],
  )

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

  const flushAndClose = useCallback(async () => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current)
      autosaveTimerRef.current = null
    }
    await performAutosave(formValues)
    onClose()
  }, [performAutosave, formValues, onClose])

  const handleClose = useCallback(async () => {
    setIsConfirmingDelete(false)
    await flushAndClose()
  }, [flushAndClose])

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

  const handleAddLabel = useCallback(async () => {
    if (!task || !newLabel.trim() || readOnly) return

    const labelToAdd = newLabel.trim()
    setIsAddingLabel(true)

    try {
      const response = await apiFetch(`/api/tasks/${task.id}/labels`, {
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

      setLabels(prev => prev.filter(l => l !== labelToRemove))

      try {
        const response = await apiFetch(
          `/api/tasks/${task.id}/labels/${encodeURIComponent(labelToRemove)}`,
          { method: "DELETE" },
        )

        const data = (await response.json()) as { ok: boolean }
        if (!data.ok) {
          setLabels(prev => [...prev, labelToRemove])
        }
      } catch (err) {
        console.error("Failed to remove label:", err)
        setLabels(prev => [...prev, labelToRemove])
      }
    },
    [task, readOnly],
  )

  const handleAddComment = useCallback(
    async (comment: string) => {
      if (!task || readOnly) return

      try {
        const response = await apiFetch(`/api/tasks/${task.id}/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ comment }),
        })

        const data = (await response.json()) as { ok: boolean; error?: string }
        if (data.ok) {
          const commentsRes = await apiFetch(`/api/tasks/${task.id}/comments`)
          const commentsData = (await commentsRes.json()) as {
            ok: boolean
            comments?: Comment[]
            error?: string
          }
          if (commentsData.ok && commentsData.comments) {
            setComments(commentsData.comments)
          }
        } else {
          throw new Error(data.error || "Failed to add comment")
        }
      } catch (err) {
        console.error("Failed to add comment:", err)
        throw err
      }
    },
    [task, readOnly],
  )

  return {
    formValues,
    labels,
    issuePrefix,
    allTasks,
    isSaving,
    isDeleting,
    isAddingLabel,
    isConfirmingDelete,
    deleteError,
    newLabel,
    showLabelInput,
    comments,
    isLoadingComments,
    commentsError,
    updateTitle,
    updateDescription,
    updateStatus,
    updatePriority,
    updateIssueType,
    updateParent,
    setNewLabel,
    setShowLabelInput,
    handleAddLabel,
    handleRemoveLabel,
    handleAddComment,
    startDelete,
    cancelDelete,
    confirmDelete,
    handleClose,
  }
}

export type IssueType = "task" | "bug" | "epic"

export interface UseTaskDetailsOptions {
  /** The task to edit. */
  task: Task | null
  /** Whether the dialog is open. */
  open: boolean
  /** Whether the dialog is in read-only mode. */
  readOnly?: boolean
  /** Callback when save is triggered. */
  onSave?: (id: string, updates: TaskUpdateData) => void | Promise<void>
  /** Callback when delete is triggered. */
  onDelete?: (id: string) => void | Promise<void>
  /** Callback when close is triggered. */
  onClose: () => void
  /** Current session ID for linking to tasks when closed (optional). */
  currentSessionId?: string | null
}

export interface TaskFormValues {
  /** Task title. */
  title: string
  /** Task description. */
  description: string
  /** Task status. */
  status: TaskStatus
  /** Task priority. */
  priority: number
  /** Task issue type. */
  issueType: IssueType
  /** Parent task ID. */
  parent: string | null
}

export interface UseTaskDetailsResult {
  /** Form values. */
  formValues: TaskFormValues
  /** Current labels. */
  labels: string[]
  /** Issue prefix for display. */
  issuePrefix: string | null
  /** All tasks for parent selection. */
  allTasks: Task[]
  /** Whether a save is in progress. */
  isSaving: boolean
  /** Whether a delete is in progress. */
  isDeleting: boolean
  /** Whether a label add is in progress. */
  isAddingLabel: boolean
  /** Whether delete confirmation is visible. */
  isConfirmingDelete: boolean
  /** Error for delete operations. */
  deleteError: string | null
  /** New label input value. */
  newLabel: string
  /** Whether label input is visible. */
  showLabelInput: boolean
  /** Current comments. */
  comments: Comment[]
  /** Whether comments are loading. */
  isLoadingComments: boolean
  /** Error for comment operations. */
  commentsError: string | null
  /** Update task title. */
  updateTitle: (title: string) => void
  /** Update task description. */
  updateDescription: (description: string) => void
  /** Update task status. */
  updateStatus: (status: TaskStatus) => void
  /** Update task priority. */
  updatePriority: (priority: number) => void
  /** Update task issue type. */
  updateIssueType: (issueType: IssueType) => void
  /** Update task parent. */
  updateParent: (parent: string | null) => void
  /** Set label input value. */
  setNewLabel: (label: string) => void
  /** Toggle label input visibility. */
  setShowLabelInput: (show: boolean) => void
  /** Add a label to the task. */
  handleAddLabel: () => Promise<void>
  /** Remove a label from the task. */
  handleRemoveLabel: (label: string) => Promise<void>
  /** Add a comment to the task. */
  handleAddComment: (comment: string) => Promise<void>
  /** Start delete confirmation. */
  startDelete: () => void
  /** Cancel delete confirmation. */
  cancelDelete: () => void
  /** Confirm delete action. */
  confirmDelete: () => Promise<void>
  /** Close the dialog. */
  handleClose: () => Promise<void>
}
