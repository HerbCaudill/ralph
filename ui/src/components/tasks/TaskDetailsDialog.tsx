import { useState, useCallback, useEffect, useRef } from "react"
import {
  IconCircle,
  IconCircleDot,
  IconCircleCheck,
  IconBan,
  IconClock,
  IconX,
  IconPlus,
  IconTrash,
  type TablerIcon,
} from "@tabler/icons-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn, stripTaskPrefix } from "@/lib/utils"
import { useAppStore, selectIssuePrefix, selectTasks } from "@/store"
import type { TaskCardTask, TaskStatus } from "./TaskCard"
import { IconBug, IconStack2, IconCheckbox } from "@tabler/icons-react"
import { CommentsSection } from "./CommentsSection"
import { MarkdownContent } from "@/components/ui/MarkdownContent"
import { RelatedTasks } from "./RelatedTasks"

// Types

export interface TaskDetailsDialogProps {
  /** The task to display/edit, or null if dialog should be closed */
  task: TaskCardTask | null
  /** Whether the dialog is open */
  open: boolean
  /** Callback when the dialog should close */
  onClose: () => void
  /** Callback when the task is saved */
  onSave?: (id: string, updates: TaskUpdateData) => void | Promise<void>
  /** Callback when the task is deleted */
  onDelete?: (id: string) => void | Promise<void>
  /** Whether the dialog is in read-only mode (default: false) */
  readOnly?: boolean
}

export interface TaskUpdateData {
  title?: string
  description?: string
  status?: TaskStatus
  priority?: number
  issue_type?: string
  parent?: string | null
}

// Issue Type Options
export type IssueType = "task" | "bug" | "epic"

const issueTypeOptions: {
  value: IssueType
  label: string
  icon: typeof IconCheckbox
  color: string
}[] = [
  { value: "task", label: "Task", icon: IconCheckbox, color: "text-gray-500" },
  { value: "bug", label: "Bug", icon: IconBug, color: "text-red-500" },
  { value: "epic", label: "Epic", icon: IconStack2, color: "text-indigo-500" },
]

// Status Configuration

interface StatusConfig {
  icon: TablerIcon
  label: string
  color: string
}

const statusConfig: Record<TaskStatus, StatusConfig> = {
  open: {
    icon: IconCircle,
    label: "Open",
    color: "text-gray-500",
  },
  in_progress: {
    icon: IconCircleDot,
    label: "In Progress",
    color: "text-blue-500",
  },
  blocked: {
    icon: IconBan,
    label: "Blocked",
    color: "text-red-500",
  },
  deferred: {
    icon: IconClock,
    label: "Deferred",
    color: "text-amber-500",
  },
  closed: {
    icon: IconCircleCheck,
    label: "Closed",
    color: "text-green-500",
  },
}

const statusOptions: TaskStatus[] = ["open", "in_progress", "blocked", "deferred", "closed"]

const priorityOptions = [
  { value: 0, label: "P0 - Critical" },
  { value: 1, label: "P1 - High" },
  { value: 2, label: "P2 - Medium" },
  { value: 3, label: "P3 - Low" },
  { value: 4, label: "P4 - Lowest" },
]

// TaskDetailsDialog Component

/**
 * Dialog for viewing and editing task details.
 * Displays task title, description, status, and priority with editable fields.
 */
/**
 * Save an event log and add a closing comment to the task.
 * Returns the event log ID if successful, null otherwise.
 */
async function saveEventLogAndAddComment(
  taskId: string,
  taskTitle: string,
  events: Array<{ type: string; timestamp: number; [key: string]: unknown }>,
  workspacePath: string | null,
): Promise<string | null> {
  // Only save if there are events
  if (events.length === 0) {
    return null
  }

  try {
    // Save the event log
    const response = await fetch("/api/eventlogs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        events,
        metadata: {
          taskId,
          title: taskTitle,
          source: "task-close",
          workspacePath: workspacePath ?? undefined,
        },
      }),
    })

    if (!response.ok) {
      console.error("Failed to save event log:", await response.text())
      return null
    }

    const result = (await response.json()) as { ok: boolean; eventlog?: { id: string } }
    if (!result.ok || !result.eventlog?.id) {
      return null
    }

    const eventLogId = result.eventlog.id

    // Add closing comment with event log link
    const commentResponse = await fetch(`/api/tasks/${taskId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        comment: `Closed. Event log: #eventlog=${eventLogId}`,
        author: "Ralph",
      }),
    })

    if (!commentResponse.ok) {
      console.error("Failed to add closing comment:", await commentResponse.text())
      // Still return the event log ID even if comment failed
    }

    return eventLogId
  } catch (err) {
    console.error("Error saving event log:", err)
    return null
  }
}

export function TaskDetailsDialog({
  task,
  open,
  onClose,
  onSave,
  onDelete,
  readOnly = false,
}: TaskDetailsDialogProps) {
  // Get events, workspace, issue prefix, and tasks from store
  const events = useAppStore(state => state.events)
  const workspace = useAppStore(state => state.workspace)
  const issuePrefix = useAppStore(selectIssuePrefix)
  const allTasks = useAppStore(selectTasks)

  // Local state for editable fields
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [status, setStatus] = useState<TaskStatus>("open")
  const [priority, setPriority] = useState<number>(2)
  const [issueType, setIssueType] = useState<IssueType>("task")
  const [parent, setParent] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  // Delete state
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Labels state
  const [labels, setLabels] = useState<string[]>([])
  const [newLabel, setNewLabel] = useState("")
  const [isAddingLabel, setIsAddingLabel] = useState(false)
  const [showLabelInput, setShowLabelInput] = useState(false)
  const labelInputRef = useRef<HTMLInputElement>(null)

  // Description edit mode state
  const [isEditingDescription, setIsEditingDescription] = useState(false)
  const descriptionTextareaRef = useRef<HTMLTextAreaElement>(null)

  // Fetch labels when task changes
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

  // Reset local state when task changes
  useEffect(() => {
    if (task) {
      setTitle(task.title)
      setDescription(task.description ?? "")
      setStatus(task.status)
      setPriority(task.priority ?? 2)
      setIssueType((task.issue_type as IssueType) ?? "task")
      setParent(task.parent ?? null)
      setLabels(task.labels ?? [])
      setNewLabel("")
      setShowLabelInput(false)
      setIsEditingDescription(false)
      setHasChanges(false)
      setIsConfirmingDelete(false)
      setIsDeleting(false)
      setDeleteError(null)
    }
  }, [task])

  // Track changes
  useEffect(() => {
    if (!task) return
    const changed =
      title !== task.title ||
      description !== (task.description ?? "") ||
      status !== task.status ||
      priority !== (task.priority ?? 2) ||
      issueType !== ((task.issue_type as IssueType) ?? "task") ||
      parent !== (task.parent ?? null)
    setHasChanges(changed)
  }, [task, title, description, status, priority, issueType, parent])

  const handleSave = useCallback(async () => {
    if (!task || !onSave || readOnly) return

    const updates: TaskUpdateData = {}
    if (title !== task.title) updates.title = title
    if (description !== (task.description ?? "")) updates.description = description
    if (status !== task.status) updates.status = status
    if (priority !== (task.priority ?? 2)) updates.priority = priority
    if (issueType !== ((task.issue_type as IssueType) ?? "task")) updates.issue_type = issueType
    if (parent !== (task.parent ?? null)) updates.parent = parent

    if (Object.keys(updates).length === 0) {
      onClose()
      return
    }

    setIsSaving(true)
    try {
      // If closing the task (status changed to closed), save event log first
      const isClosing = status === "closed" && task.status !== "closed"
      if (isClosing) {
        await saveEventLogAndAddComment(task.id, task.title, events, workspace)
      }

      await onSave(task.id, updates)
      onClose()
    } catch (error) {
      console.error("Failed to save task:", error)
    } finally {
      setIsSaving(false)
    }
  }, [
    task,
    onSave,
    readOnly,
    title,
    description,
    status,
    priority,
    issueType,
    parent,
    onClose,
    events,
    workspace,
  ])

  const handleClose = useCallback(() => {
    setIsConfirmingDelete(false)
    onClose()
  }, [onClose])

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

  // Focus label input when shown
  useEffect(() => {
    if (showLabelInput && labelInputRef.current) {
      labelInputRef.current.focus()
    }
  }, [showLabelInput])

  // Focus description textarea when entering edit mode
  useEffect(() => {
    if (isEditingDescription && descriptionTextareaRef.current) {
      descriptionTextareaRef.current.focus()
      // Move cursor to end
      const len = descriptionTextareaRef.current.value.length
      descriptionTextareaRef.current.setSelectionRange(len, len)
    }
  }, [isEditingDescription])

  // Handle description edit completion (blur or escape)
  const handleDescriptionBlur = useCallback(() => {
    setIsEditingDescription(false)
  }, [])

  const handleDescriptionKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Escape") {
        // Reset to original value and exit edit mode
        setDescription(task?.description ?? "")
        setIsEditingDescription(false)
      }
    },
    [task],
  )

  // Handle Cmd+Enter / Ctrl+Enter to save
  useEffect(() => {
    if (!open || readOnly) return

    const handleKeyDown = (event: KeyboardEvent) => {
      const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform)
      const modifierPressed = isMac ? event.metaKey : event.ctrlKey

      if (modifierPressed && event.key === "Enter" && hasChanges && !isSaving) {
        event.preventDefault()
        handleSave()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [open, readOnly, hasChanges, isSaving, handleSave])

  if (!task) return null

  const StatusIcon = statusConfig[status].icon

  return (
    <Dialog open={open} onOpenChange={isOpen => !isOpen && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <StatusIcon className={cn("h-5 w-5", statusConfig[status].color)} />
            <span className="text-muted-foreground font-mono text-sm">
              {stripTaskPrefix(task.id, issuePrefix)}
            </span>
          </DialogTitle>
          <DialogDescription className="sr-only">Edit task details</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Title */}
          <div className="grid gap-2">
            <Label htmlFor="task-title">Title</Label>
            {readOnly ?
              <p className="text-sm">{title}</p>
            : <Input
                id="task-title"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Task title"
              />
            }
          </div>

          {/* Description */}
          <div className="grid gap-2">
            <Label htmlFor="task-description">Description</Label>
            {readOnly ?
              description ?
                <MarkdownContent className="text-muted-foreground">{description}</MarkdownContent>
              : <p className="text-muted-foreground text-sm">No description</p>
            : isEditingDescription ?
              <Textarea
                ref={descriptionTextareaRef}
                id="task-description"
                value={description}
                onChange={e => setDescription(e.target.value)}
                onBlur={handleDescriptionBlur}
                onKeyDown={handleDescriptionKeyDown}
                placeholder="Task description (optional)"
                rows={4}
              />
            : <div
                onClick={() => setIsEditingDescription(true)}
                onKeyDown={e => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    setIsEditingDescription(true)
                  }
                }}
                role="button"
                tabIndex={0}
                className={cn(
                  "border-input hover:border-ring focus-visible:ring-ring min-h-[100px] cursor-text rounded-md border px-3 py-2 text-sm transition-colors focus-visible:ring-1 focus-visible:outline-none",
                  !description && "text-muted-foreground",
                )}
              >
                {description ?
                  <MarkdownContent>{description}</MarkdownContent>
                : "Click to add description..."}
              </div>
            }
          </div>

          {/* Status and Priority row */}
          <div className="grid grid-cols-2 gap-4">
            {/* Status */}
            <div className="grid gap-2">
              <Label htmlFor="task-status">Status</Label>
              {readOnly ?
                <div className="flex items-center gap-2">
                  <StatusIcon className={cn("h-4 w-4", statusConfig[status].color)} />
                  <span className="text-sm">{statusConfig[status].label}</span>
                </div>
              : <Select value={status} onValueChange={value => setStatus(value as TaskStatus)}>
                  <SelectTrigger id="task-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map(s => {
                      const config = statusConfig[s]
                      const Icon = config.icon
                      return (
                        <SelectItem key={s} value={s}>
                          <div className="flex items-center gap-2">
                            <Icon className={cn("h-4 w-4", config.color)} />
                            <span>{config.label}</span>
                          </div>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              }
            </div>

            {/* Priority */}
            <div className="grid gap-2">
              <Label htmlFor="task-priority">Priority</Label>
              {readOnly ?
                <span className="text-sm">
                  {priorityOptions.find(p => p.value === priority)?.label ?? `P${priority}`}
                </span>
              : <Select
                  value={String(priority)}
                  onValueChange={value => setPriority(Number(value))}
                >
                  <SelectTrigger id="task-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {priorityOptions.map(p => (
                      <SelectItem key={p.value} value={String(p.value)}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              }
            </div>
          </div>

          {/* Labels */}
          <div className="grid gap-2">
            <Label>Labels</Label>
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

          {/* Type and Parent row */}
          <div className="grid grid-cols-2 gap-4">
            {/* Type */}
            <div className="grid gap-2">
              <Label>Type</Label>
              {readOnly ?
                <div className="flex items-center gap-2">
                  {(() => {
                    const typeOption = issueTypeOptions.find(t => t.value === issueType)
                    const TypeIcon = typeOption?.icon ?? IconCheckbox
                    return (
                      <>
                        <TypeIcon className={cn("h-4 w-4", typeOption?.color ?? "text-gray-500")} />
                        <span className="text-sm capitalize">{issueType}</span>
                      </>
                    )
                  })()}
                </div>
              : <div className="border-input bg-background flex rounded-md border" role="group">
                  {issueTypeOptions.map(t => {
                    const Icon = t.icon
                    const isSelected = issueType === t.value
                    return (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setIssueType(t.value)}
                        className={cn(
                          "flex flex-1 items-center justify-center gap-1.5 px-2 py-1.5 text-sm transition-colors first:rounded-l-md last:rounded-r-md",
                          isSelected ?
                            "bg-accent text-accent-foreground"
                          : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground",
                        )}
                        aria-pressed={isSelected}
                      >
                        <Icon className={cn("h-4 w-4", isSelected ? t.color : "")} />
                        <span>{t.label}</span>
                      </button>
                    )
                  })}
                </div>
              }
            </div>

            {/* Parent */}
            <div className="grid gap-2">
              <Label htmlFor="task-parent">Parent</Label>
              {readOnly ?
                <span className="text-muted-foreground text-sm">
                  {task.parent ?
                    <span className="text-foreground font-mono">
                      {stripTaskPrefix(task.parent, issuePrefix)}
                    </span>
                  : <span>None</span>}
                </span>
              : (() => {
                  // Filter valid parent candidates (exclude self and direct children)
                  const validParents = allTasks.filter(
                    t => t.id !== task.id && t.parent !== task.id,
                  )
                  // Check if current parent is in the list of valid parents
                  const currentParentInList = parent && validParents.some(t => t.id === parent)
                  return (
                    <Select
                      value={parent ?? "__none__"}
                      onValueChange={value => setParent(value === "__none__" ? null : value)}
                    >
                      <SelectTrigger id="task-parent">
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {/* If current parent isn't in list, show it as an option */}
                        {parent && !currentParentInList && (
                          <SelectItem value={parent}>
                            <span className="font-mono text-xs">
                              {stripTaskPrefix(parent, issuePrefix)}
                            </span>
                          </SelectItem>
                        )}
                        {validParents.map(t => (
                          <SelectItem key={t.id} value={t.id}>
                            <span className="font-mono text-xs">
                              {stripTaskPrefix(t.id, issuePrefix)}
                            </span>
                            <span className="ml-2 truncate">{t.title}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )
                })()
              }
            </div>
          </div>

          {/* Related Tasks (children and blockers) */}
          <RelatedTasks taskId={task.id} />

          {/* Comments Section */}
          <CommentsSection taskId={task.id} readOnly={readOnly} />
        </div>

        {!readOnly && (
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
            {/* Delete section - left side */}
            {onDelete && (
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  {isConfirmingDelete ?
                    <>
                      <span className="text-destructive text-sm">Delete this task?</span>
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

            {/* Save/Cancel section - right side */}
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleClose} disabled={isSaving || isDeleting}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving || isDeleting || !hasChanges}>
                {isSaving ? "Saving..." : "Save changes"}
              </Button>
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
