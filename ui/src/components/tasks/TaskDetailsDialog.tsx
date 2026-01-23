import { useState, useCallback, useEffect, useRef, useMemo } from "react"
import {
  IconCircle,
  IconCircleDot,
  IconCircleCheck,
  IconBan,
  IconClock,
  IconX,
  IconPlus,
  IconTrash,
  IconBug,
  IconStack2,
  IconCheckbox,
  type TablerIcon,
} from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn, stripTaskPrefix } from "@/lib/utils"
import { useAppStore, selectIssuePrefix, selectTasks } from "@/store"
import type { TaskCardTask, TaskStatus, TaskUpdateData } from "@/types"
import { CommentsSection } from "./CommentsSection"
import { MarkdownContent } from "@/components/ui/MarkdownContent"
import { MarkdownEditor } from "@/components/ui/MarkdownEditor"
import { RelatedTasks } from "./RelatedTasks"
import { ParentCombobox } from "./ParentCombobox"
import { IterationLinks } from "./IterationLinks"
import { saveEventLogAndAddComment } from "@/lib/saveEventLogAndAddComment"

export function TaskDetailsDialog({
  task,
  open,
  onClose,
  onSave,
  onDelete,
  readOnly = false,
}: TaskDetailsDialogProps) {
  /**
   * Get events, workspace, issue prefix, and tasks from store
   */
  const events = useAppStore(state => state.events)
  const workspace = useAppStore(state => state.workspace)
  const issuePrefix = useAppStore(selectIssuePrefix)
  const allTasks = useAppStore(selectTasks)

  /**
   * Local state for editable fields
   */
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [status, setStatus] = useState<TaskStatus>("open")
  const [priority, setPriority] = useState<number>(2)
  const [issueType, setIssueType] = useState<IssueType>("task")
  const [parent, setParent] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  /**
   * Track the last saved values to detect changes
   */
  const lastSavedRef = useRef<{
    title: string
    description: string
    status: TaskStatus
    priority: number
    issueType: IssueType
    parent: string | null
  } | null>(null)

  /**
   * Debounce timer ref for text field autosave
   */
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /**
   * Delete state
   */
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  /**
   * Labels state
   */
  const [labels, setLabels] = useState<string[]>([])
  const [newLabel, setNewLabel] = useState("")
  const [isAddingLabel, setIsAddingLabel] = useState(false)
  const [showLabelInput, setShowLabelInput] = useState(false)
  const labelInputRef = useRef<HTMLInputElement>(null)

  /**
   * Title textarea ref for auto-sizing
   */
  const titleTextareaRef = useRef<HTMLTextAreaElement>(null)

  /**
   * Fetch labels when task changes
   */
  useEffect(() => {
    if (task && open) {
      // Fetch labels from API
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

  /**
   * Reset local state when task changes
   */
  useEffect(() => {
    if (task) {
      const initialValues = {
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

  /**
   * Cleanup autosave timer on unmount
   */
  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current)
      }
    }
  }, [])

  /**
   * Saves only the fields that have changed since last save. If closing the task, also saves the event log.
   */
  const performAutosave = useCallback(
    async (currentValues: {
      title: string
      description: string
      status: TaskStatus
      priority: number
      issueType: IssueType
      parent: string | null
    }) => {
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
        // If closing the task (status changed to closed), save event log first
        const isClosing = currentValues.status === "closed" && lastSaved.status !== "closed"
        if (isClosing) {
          await saveEventLogAndAddComment(task.id, task.title, events, workspace)
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
    [task, onSave, readOnly, events, workspace],
  )

  /**
   * Schedules an autosave with a 500ms debounce to avoid too many API calls.
   */
  const scheduleAutosave = useCallback(
    (currentValues: {
      title: string
      description: string
      status: TaskStatus
      priority: number
      issueType: IssueType
      parent: string | null
    }) => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current)
      }
      autosaveTimerRef.current = setTimeout(() => {
        performAutosave(currentValues)
      }, 500)
    },
    [performAutosave],
  )

  /**
   * Immediately autosaves for non-text fields, canceling any pending debounced save.
   */
  const immediateAutosave = useCallback(
    (currentValues: {
      title: string
      description: string
      status: TaskStatus
      priority: number
      issueType: IssueType
      parent: string | null
    }) => {
      // Cancel any pending debounced save
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current)
      }
      performAutosave(currentValues)
    },
    [performAutosave],
  )

  /**
   * Memoized current values for autosave to avoid unnecessary callback updates.
   */
  const currentValues = useMemo(
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

  /**
   * Flushes any pending autosave before closing the dialog.
   */
  const flushAndClose = useCallback(async () => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current)
      autosaveTimerRef.current = null
    }
    // Perform final save with current values
    await performAutosave(currentValues)
    onClose()
  }, [performAutosave, currentValues, onClose])

  /**
   * Closes the dialog after resetting the delete confirmation state.
   */
  const handleClose = useCallback(async () => {
    setIsConfirmingDelete(false)
    await flushAndClose()
  }, [flushAndClose])

  /**
   * Deletes the current task and closes the dialog on success.
   */
  const handleDelete = useCallback(async () => {
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

  /**
   * Adds a new label to the task and clears the input field.
   */
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

  /**
   * Removes a label from the task with optimistic UI updates.
   */
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

  /**
   * Handles Enter and Escape keys in the label input field.
   */
  const handleLabelInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault()
        handleAddLabel()
      } else if (e.key === "Escape") {
        setShowLabelInput(false)
        setNewLabel("")
      }
    },
    [handleAddLabel],
  )

  /**
   * Focuses the label input field when it becomes visible.
   */
  useEffect(() => {
    if (showLabelInput && labelInputRef.current) {
      labelInputRef.current.focus()
    }
  }, [showLabelInput])

  /**
   * Auto-sizes the title textarea when the title changes or dialog opens.
   */
  useEffect(() => {
    if (titleTextareaRef.current) {
      titleTextareaRef.current.style.height = "auto"
      titleTextareaRef.current.style.height = `${titleTextareaRef.current.scrollHeight}px`
    }
  }, [title, open])

  /**
   * Handles global keyboard shortcuts for the dialog: Escape to close, Cmd/Ctrl+Enter to close (saves automatically).
   */
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't handle escape if user is typing in an input, textarea, or select
      const target = event.target as HTMLElement
      const isInFormElement =
        target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT"

      // Escape to close (unless in a form element where escape has other meaning)
      if (event.key === "Escape" && !isInFormElement) {
        event.preventDefault()
        handleClose()
        return
      }

      // Cmd+Enter / Ctrl+Enter to close (changes are saved automatically)
      if (!readOnly && !isSaving) {
        const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform)
        const modifierPressed = isMac ? event.metaKey : event.ctrlKey

        if (modifierPressed && event.key === "Enter") {
          event.preventDefault()
          handleClose()
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [open, readOnly, isSaving, handleClose])

  /**
   * Don't render anything if there's no task or it's not open
   */
  if (!task || !open) return null

  const StatusIcon = statusConfig[status].icon

  return (
    <div
      className="bg-background border-border flex h-full flex-col border-l shadow-lg"
      role="dialog"
      aria-modal="false"
      aria-label="Task details"
    >
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b p-4">
        <div className="flex items-center gap-2">
          <StatusIcon className={cn("h-5 w-5", statusConfig[status].color)} />
          <span className="text-muted-foreground font-mono text-sm">
            {stripTaskPrefix(task.id, issuePrefix)}
          </span>
        </div>
        <button
          type="button"
          onClick={handleClose}
          className="ring-offset-background focus:ring-ring rounded-sm p-1 opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-none"
          aria-label="Close panel"
        >
          <IconX className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto p-6">
        {/* Title */}
        <div>
          {readOnly ?
            <p className="text-lg font-semibold">{title}</p>
          : <textarea
              ref={titleTextareaRef}
              id="task-title"
              value={title}
              onChange={e => {
                const newTitle = e.target.value
                setTitle(newTitle)
                // Auto-grow textarea
                const target = e.target
                target.style.height = "auto"
                target.style.height = `${target.scrollHeight}px`
                scheduleAutosave({ ...currentValues, title: newTitle })
              }}
              onKeyDown={e => {
                // Prevent Enter from adding newlines in title
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                }
              }}
              placeholder="Task title"
              className="text-foreground placeholder:text-muted-foreground w-full resize-none overflow-hidden bg-transparent text-lg font-semibold focus:outline-none"
              rows={1}
            />
          }
        </div>

        {/* Description */}
        <div>
          {readOnly ?
            description ?
              <MarkdownContent className="text-muted-foreground text-sm">
                {description}
              </MarkdownContent>
            : null
          : <MarkdownEditor
              value={description}
              onChange={newDescription => {
                setDescription(newDescription)
                scheduleAutosave({ ...currentValues, description: newDescription })
              }}
              placeholder="Add description..."
              showToolbar={false}
              size="sm"
            />
          }
        </div>

        {/* Metadata - horizontal layout with aligned labels */}
        <div className="flex flex-col gap-2.5">
          {/* Status */}
          <div className="flex items-center gap-3">
            <Label htmlFor="task-status" className="text-muted-foreground w-16 shrink-0 text-xs">
              Status
            </Label>
            {readOnly ?
              <div className="flex items-center gap-2">
                <StatusIcon className={cn("h-3.5 w-3.5", statusConfig[status].color)} />
                <span className="text-sm">{statusConfig[status].label}</span>
              </div>
            : <ButtonGroup
                separated
                className="border-input bg-background h-8 overflow-hidden rounded-md border"
              >
                {statusOptions.map(s => {
                  const config = statusConfig[s]
                  const Icon = config.icon
                  const isSelected = status === s
                  const handleStatusChange = (newStatus: TaskStatus) => {
                    setStatus(newStatus)
                    immediateAutosave({ ...currentValues, status: newStatus })
                  }
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => handleStatusChange(s)}
                      tabIndex={isSelected ? 0 : -1}
                      onKeyDown={e => {
                        if (e.key === "ArrowLeft") {
                          e.preventDefault()
                          const currentIndex = statusOptions.findIndex(opt => opt === s)
                          const prevIndex =
                            (currentIndex - 1 + statusOptions.length) % statusOptions.length
                          handleStatusChange(statusOptions[prevIndex])
                        } else if (e.key === "ArrowRight") {
                          e.preventDefault()
                          const currentIndex = statusOptions.findIndex(opt => opt === s)
                          const nextIndex = (currentIndex + 1) % statusOptions.length
                          handleStatusChange(statusOptions[nextIndex])
                        }
                      }}
                      className={cn(
                        "flex h-full items-center justify-center gap-1 px-2 text-xs transition-colors",
                        isSelected ?
                          cn("text-white", config.selectedBg)
                        : cn(config.color, config.unselectedBg, config.unselectedHover),
                      )}
                      aria-pressed={isSelected}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span>{config.label}</span>
                    </button>
                  )
                })}
              </ButtonGroup>
            }
          </div>

          {/* Priority */}
          <div className="flex items-center gap-3">
            <Label className="text-muted-foreground w-16 shrink-0 text-xs">Priority</Label>
            {readOnly ?
              <span className="text-sm">
                {priorityOptions.find(p => p.value === priority)?.label ?? `P${priority}`}
              </span>
            : <ButtonGroup
                separated
                className="border-input bg-background h-8 overflow-hidden rounded-md border"
              >
                {priorityOptions.map(p => {
                  const isSelected = priority === p.value
                  const handlePriorityChange = (newPriority: number) => {
                    setPriority(newPriority)
                    immediateAutosave({ ...currentValues, priority: newPriority })
                  }
                  return (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => handlePriorityChange(p.value)}
                      tabIndex={isSelected ? 0 : -1}
                      onKeyDown={e => {
                        if (e.key === "ArrowLeft") {
                          e.preventDefault()
                          const currentIndex = priorityOptions.findIndex(
                            opt => opt.value === p.value,
                          )
                          const prevIndex =
                            (currentIndex - 1 + priorityOptions.length) % priorityOptions.length
                          handlePriorityChange(priorityOptions[prevIndex].value)
                        } else if (e.key === "ArrowRight") {
                          e.preventDefault()
                          const currentIndex = priorityOptions.findIndex(
                            opt => opt.value === p.value,
                          )
                          const nextIndex = (currentIndex + 1) % priorityOptions.length
                          handlePriorityChange(priorityOptions[nextIndex].value)
                        }
                      }}
                      className={cn(
                        "flex h-full items-center justify-center gap-1 px-2 text-xs transition-colors",
                        isSelected ?
                          cn("text-white", p.selectedBg)
                        : cn(p.color, p.unselectedBg, p.unselectedHover),
                      )}
                      aria-pressed={isSelected}
                    >
                      <span>{p.short}</span>
                    </button>
                  )
                })}
              </ButtonGroup>
            }
          </div>

          {/* Type */}
          <div className="flex items-center gap-3">
            <Label className="text-muted-foreground w-16 shrink-0 text-xs">Type</Label>
            {readOnly ?
              <div className="flex items-center gap-2">
                {(() => {
                  const typeOption = issueTypeOptions.find(t => t.value === issueType)
                  const TypeIcon = typeOption?.icon ?? IconCheckbox
                  return (
                    <>
                      <TypeIcon
                        className={cn("h-3.5 w-3.5", typeOption?.color ?? "text-gray-500")}
                      />
                      <span className="text-sm capitalize">{issueType}</span>
                    </>
                  )
                })()}
              </div>
            : <ButtonGroup
                separated
                className="border-input bg-background h-8 overflow-hidden rounded-md border"
              >
                {issueTypeOptions.map(t => {
                  const Icon = t.icon
                  const isSelected = issueType === t.value
                  const handleTypeChange = (newType: IssueType) => {
                    setIssueType(newType)
                    immediateAutosave({ ...currentValues, issueType: newType })
                  }
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => handleTypeChange(t.value)}
                      tabIndex={isSelected ? 0 : -1}
                      onKeyDown={e => {
                        if (e.key === "ArrowLeft") {
                          e.preventDefault()
                          const currentIndex = issueTypeOptions.findIndex(
                            opt => opt.value === t.value,
                          )
                          const prevIndex =
                            (currentIndex - 1 + issueTypeOptions.length) % issueTypeOptions.length
                          handleTypeChange(issueTypeOptions[prevIndex].value)
                        } else if (e.key === "ArrowRight") {
                          e.preventDefault()
                          const currentIndex = issueTypeOptions.findIndex(
                            opt => opt.value === t.value,
                          )
                          const nextIndex = (currentIndex + 1) % issueTypeOptions.length
                          handleTypeChange(issueTypeOptions[nextIndex].value)
                        }
                      }}
                      className={cn(
                        "flex h-full items-center justify-center gap-1 px-2 text-xs transition-colors",
                        isSelected ?
                          cn("text-white", t.selectedBg)
                        : cn(t.color, t.unselectedBg, t.unselectedHover),
                      )}
                      aria-pressed={isSelected}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span>{t.label}</span>
                    </button>
                  )
                })}
              </ButtonGroup>
            }
          </div>

          {/* Parent */}
          <div className="flex items-center gap-3">
            <Label htmlFor="task-parent" className="text-muted-foreground w-16 shrink-0 text-xs">
              Parent
            </Label>
            {readOnly ?
              <span className="text-muted-foreground text-sm">
                {task.parent ?
                  <span className="text-foreground font-mono">
                    {stripTaskPrefix(task.parent, issuePrefix)}
                  </span>
                : <span>None</span>}
              </span>
            : <ParentCombobox
                task={task}
                allTasks={allTasks}
                issuePrefix={issuePrefix}
                value={parent}
                onChange={newParent => {
                  setParent(newParent)
                  immediateAutosave({ ...currentValues, parent: newParent })
                }}
              />
            }
          </div>

          {/* Labels */}
          <div className="flex items-start gap-3">
            <Label className="text-muted-foreground mt-1.5 w-16 shrink-0 text-xs">Labels</Label>
            <div className="flex flex-wrap items-center gap-1.5">
              {labels.map(label => (
                <span
                  key={label}
                  className="bg-muted text-muted-foreground inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium"
                >
                  {label}
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => handleRemoveLabel(label)}
                      className="hover:text-foreground -mr-0.5 ml-0.5 rounded-full p-0.5 transition-colors"
                      aria-label={`Remove ${label} label`}
                    >
                      <IconX className="h-3 w-3" />
                    </button>
                  )}
                </span>
              ))}
              {labels.length === 0 && readOnly && (
                <span className="text-muted-foreground text-sm">No labels</span>
              )}
              {!readOnly && !showLabelInput && (
                <button
                  type="button"
                  onClick={() => setShowLabelInput(true)}
                  className="text-muted-foreground hover:text-foreground hover:bg-muted inline-flex items-center gap-1 rounded-full border border-dashed px-2 py-0.5 text-xs transition-colors"
                >
                  <IconPlus className="h-3 w-3" />
                  Add label
                </button>
              )}
              {!readOnly && showLabelInput && (
                <div className="flex items-center gap-1">
                  <Input
                    ref={labelInputRef}
                    value={newLabel}
                    onChange={e => setNewLabel(e.target.value)}
                    onKeyDown={handleLabelInputKeyDown}
                    onBlur={() => {
                      if (!newLabel.trim()) {
                        setShowLabelInput(false)
                      }
                    }}
                    placeholder="Label name"
                    className="h-6 w-24 px-2 text-xs"
                    disabled={isAddingLabel}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2"
                    onClick={handleAddLabel}
                    disabled={!newLabel.trim() || isAddingLabel}
                  >
                    Add
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Related Tasks (text list - children and blockers) */}
        <RelatedTasks taskId={task.id} task={task} readOnly={readOnly} />

        {/* Iteration Links - links to iteration logs for this task */}
        <IterationLinks taskId={task.id} />

        {/* Comments Section - more space */}
        <CommentsSection taskId={task.id} readOnly={readOnly} />
      </div>

      {!readOnly && (
        <div className="flex shrink-0 flex-col gap-2 border-t p-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Delete section - left side */}
          {onDelete && (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                {isConfirmingDelete ?
                  <>
                    <span className="text-destructive text-sm">Delete this task?</span>
                    <ButtonGroup>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleDelete}
                        disabled={isDeleting}
                      >
                        {isDeleting ? "Deleting..." : "Yes, delete"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsConfirmingDelete(false)}
                        disabled={isDeleting}
                      >
                        Cancel
                      </Button>
                    </ButtonGroup>
                  </>
                : <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setDeleteError(null)
                      setIsConfirmingDelete(true)
                    }}
                    disabled={isSaving}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <IconTrash className="mr-1 h-4 w-4" />
                    Delete
                  </Button>
                }
              </div>
              {deleteError && <span className="text-destructive text-xs">{deleteError}</span>}
            </div>
          )}

          {/* Saving indicator - right side */}
          {isSaving && <span className="text-muted-foreground text-sm">Saving...</span>}
        </div>
      )}
    </div>
  )
}

/**
 * Configuration options for issue type selector buttons.
 */
const issueTypeOptions: {
  value: IssueType
  label: string
  icon: typeof IconCheckbox
  color: string
  selectedBg: string
  unselectedBg: string
  unselectedHover: string
}[] = [
  {
    value: "task",
    label: "Task",
    icon: IconCheckbox,
    color: "text-status-success",
    selectedBg: "bg-green-600",
    unselectedBg: "bg-green-500/5",
    unselectedHover: "hover:bg-green-500/20",
  },
  {
    value: "bug",
    label: "Bug",
    icon: IconBug,
    color: "text-red-500",
    selectedBg: "bg-red-500",
    unselectedBg: "bg-red-500/5",
    unselectedHover: "hover:bg-red-500/20",
  },
  {
    value: "epic",
    label: "Epic",
    icon: IconStack2,
    color: "text-indigo-500",
    selectedBg: "bg-indigo-500",
    unselectedBg: "bg-indigo-500/5",
    unselectedHover: "hover:bg-indigo-500/20",
  },
]

/**
 * Configuration for task status display (icons, labels, and colors).
 */
const statusConfig: Record<TaskStatus, StatusConfig> = {
  open: {
    icon: IconCircle,
    label: "Open",
    color: "text-gray-500",
    selectedBg: "bg-gray-500",
    unselectedBg: "bg-gray-500/5",
    unselectedHover: "hover:bg-gray-500/20",
  },
  in_progress: {
    icon: IconCircleDot,
    label: "In Progress",
    color: "text-blue-500",
    selectedBg: "bg-blue-500",
    unselectedBg: "bg-blue-500/5",
    unselectedHover: "hover:bg-blue-500/20",
  },
  blocked: {
    icon: IconBan,
    label: "Blocked",
    color: "text-red-500",
    selectedBg: "bg-red-500",
    unselectedBg: "bg-red-500/5",
    unselectedHover: "hover:bg-red-500/20",
  },
  deferred: {
    icon: IconClock,
    label: "Deferred",
    color: "text-amber-500",
    selectedBg: "bg-amber-500",
    unselectedBg: "bg-amber-500/5",
    unselectedHover: "hover:bg-amber-500/20",
  },
  closed: {
    icon: IconCircleCheck,
    label: "Closed",
    color: "text-green-500",
    selectedBg: "bg-green-500",
    unselectedBg: "bg-green-500/5",
    unselectedHover: "hover:bg-green-500/20",
  },
}

/**
 * Available task status values for the status selector.
 */
const statusOptions: TaskStatus[] = ["open", "in_progress", "blocked", "deferred", "closed"]

/**
 * Configuration options for priority selector buttons.
 */
const priorityOptions = [
  {
    value: 0,
    label: "P0 - Critical",
    short: "P0",
    color: "text-red-600",
    selectedBg: "bg-red-600",
    unselectedBg: "bg-red-600/5",
    unselectedHover: "hover:bg-red-600/20",
  },
  {
    value: 1,
    label: "P1 - High",
    short: "P1",
    color: "text-orange-500",
    selectedBg: "bg-orange-500",
    unselectedBg: "bg-orange-500/5",
    unselectedHover: "hover:bg-orange-500/20",
  },
  {
    value: 2,
    label: "P2 - Medium",
    short: "P2",
    color: "text-amber-500",
    selectedBg: "bg-amber-500",
    unselectedBg: "bg-amber-500/5",
    unselectedHover: "hover:bg-amber-500/20",
  },
  {
    value: 3,
    label: "P3 - Low",
    short: "P3",
    color: "text-yellow-500",
    selectedBg: "bg-yellow-500",
    unselectedBg: "bg-yellow-500/5",
    unselectedHover: "hover:bg-yellow-500/20",
  },
  {
    value: 4,
    label: "P4 - Lowest",
    short: "P4",
    color: "text-gray-500",
    selectedBg: "bg-gray-500",
    unselectedBg: "bg-gray-500/5",
    unselectedHover: "hover:bg-gray-500/20",
  },
]

type TaskDetailsDialogProps = {
  task: TaskCardTask | null
  open: boolean
  onClose: () => void
  onSave?: (id: string, updates: TaskUpdateData) => void | Promise<void>
  onDelete?: (id: string) => void | Promise<void>
  readOnly?: boolean
}

type IssueType = "task" | "bug" | "epic"

type StatusConfig = {
  icon: TablerIcon
  label: string
  color: string
  selectedBg: string
  unselectedBg: string
  unselectedHover: string
}
