import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
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
import { Button, ButtonGroup, Input, Label, Textarea } from "@herbcaudill/components"
import { cn } from "../../lib/cn"
import { stripTaskPrefix } from "../../lib/stripTaskPrefix"
import { CopyableTaskId } from "./CopyableTaskId"
import type { Task, TaskStatus, Comment } from "../../types"
import { CommentsSection } from "./CommentsSection"
import { MarkdownContent } from "@herbcaudill/agent-view"
import { RelatedTasks } from "./RelatedTasks"
import { TaskRelationCombobox } from "./TaskRelationCombobox"
import type { IssueType, TaskFormValues } from "../../hooks/useTaskDetails"

/**
 * Presentational component for task details.
 *
 * This is a pure component that receives all data via props.
 * It handles rendering the task details UI including title, description,
 * status, priority, type, parent, labels, and related tasks.
 * Business logic and store access are handled by the parent controller.
 */
export function TaskDetails({
  task,
  open,
  readOnly = false,
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
  canDelete,
  onUpdateTitle,
  onUpdateDescription,
  onUpdateStatus,
  onUpdatePriority,
  onUpdateIssueType,
  onUpdateParent,
  onSetNewLabel,
  onSetShowLabelInput,
  onAddLabel,
  onRemoveLabel,
  onAddComment,
  onStartDelete,
  onCancelDelete,
  onConfirmDelete,
  onClose,
  renderDescriptionEditor,
  renderSessionLinks,
}: TaskDetailsProps) {
  // Label input ref
  const labelInputRef = useRef<HTMLInputElement>(null)

  // Title textarea ref for auto-sizing
  const titleTextareaRef = useRef<HTMLTextAreaElement>(null)

  // Description textarea ref for auto-focus
  const descriptionTextareaRef = useRef<HTMLTextAreaElement>(null)

  // Track whether description is in edit mode (click-to-edit)
  const [isEditingDescription, setIsEditingDescription] = useState(false)

  // Handles Enter and Escape keys in the label input field
  const handleLabelInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault()
        onAddLabel()
      } else if (e.key === "Escape") {
        onSetShowLabelInput(false)
        onSetNewLabel("")
      }
    },
    [onAddLabel, onSetShowLabelInput, onSetNewLabel],
  )

  // Focus label input when it becomes visible
  useEffect(() => {
    if (showLabelInput && labelInputRef.current) {
      labelInputRef.current.focus()
    }
  }, [showLabelInput])

  // Auto-size title textarea
  useEffect(() => {
    if (titleTextareaRef.current) {
      titleTextareaRef.current.style.height = "auto"
      titleTextareaRef.current.style.height = `${titleTextareaRef.current.scrollHeight}px`
    }
  }, [formValues.title, open])

  // Reset description editing state when task changes or dialog closes
  useEffect(() => {
    setIsEditingDescription(false)
  }, [task?.id, open])

  // Handle global keyboard shortcuts
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
        onClose()
        return
      }

      // Cmd+Enter / Ctrl+Enter to close (changes are saved automatically)
      if (!readOnly && !isSaving) {
        const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform)
        const modifierPressed = isMac ? event.metaKey : event.ctrlKey

        if (modifierPressed && event.key === "Enter") {
          event.preventDefault()
          onClose()
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [open, readOnly, isSaving, onClose])

  // Don't render anything if there's no task or it's not open
  if (!task || !open) return null

  const StatusIcon = statusConfig[formValues.status].icon

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
          <StatusIcon className={cn("h-5 w-5", statusConfig[formValues.status].color)} />
          <CopyableTaskId
            taskId={task.id}
            displayId={stripTaskPrefix(task.id, issuePrefix)}
            className="text-sm"
          />
        </div>
        <button
          type="button"
          onClick={onClose}
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
            <p className="text-lg font-semibold">{formValues.title}</p>
          : <textarea
              ref={titleTextareaRef}
              id="task-title"
              value={formValues.title}
              onChange={e => {
                const newTitle = e.target.value
                onUpdateTitle(newTitle)
                // Auto-grow textarea
                const target = e.target
                target.style.height = "auto"
                target.style.height = `${target.scrollHeight}px`
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
            formValues.description ?
              <MarkdownContent className="text-muted-foreground text-sm">
                {formValues.description}
              </MarkdownContent>
            : null
          : renderDescriptionEditor ?
            renderDescriptionEditor({
              value: formValues.description,
              onChange: onUpdateDescription,
              placeholder: "Add description...",
            })
          : isEditingDescription || !formValues.description ?
            <Textarea
              ref={descriptionTextareaRef}
              value={formValues.description}
              onChange={e => onUpdateDescription(e.target.value)}
              onBlur={() => setIsEditingDescription(false)}
              onKeyDown={e => {
                if (e.key === "Escape") {
                  e.stopPropagation()
                  setIsEditingDescription(false)
                }
              }}
              placeholder="Add description..."
              className="min-h-25"
              autoFocus={isEditingDescription}
            />
          : <button
              type="button"
              onClick={() => setIsEditingDescription(true)}
              className="text-muted-foreground hover:bg-muted/50 w-full cursor-pointer rounded-md p-2 text-left text-sm transition-colors"
            >
              <MarkdownContent className="text-muted-foreground text-sm">
                {formValues.description}
              </MarkdownContent>
            </button>
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
                <StatusIcon className={cn("h-3.5 w-3.5", statusConfig[formValues.status].color)} />
                <span className="text-sm">{statusConfig[formValues.status].label}</span>
              </div>
            : <ButtonGroup responsive size="sm">
                {statusOptions.map(s => {
                  const config = statusConfig[s]
                  const Icon = config.icon
                  const isSelected = formValues.status === s
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => onUpdateStatus(s)}
                      className={cn(
                        "flex h-full items-center justify-center gap-1 px-2 transition-colors",
                        isSelected ?
                          cn("text-white", config.selectedBg)
                        : cn(config.color, config.unselectedBg, config.unselectedHover),
                      )}
                      aria-pressed={isSelected}
                    >
                      <Icon className="h-3 w-3 shrink-0" />
                      <span data-label>{config.label}</span>
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
                {priorityOptions.find(p => p.value === formValues.priority)?.label ??
                  `P${formValues.priority}`}
              </span>
            : <ButtonGroup responsive size="sm">
                {priorityOptions.map(p => {
                  const isSelected = formValues.priority === p.value
                  return (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => onUpdatePriority(p.value)}
                      className={cn(
                        "flex h-full items-center justify-center gap-1 px-2 transition-colors",
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
                  const typeOption = issueTypeOptions.find(t => t.value === formValues.issueType)
                  const TypeIcon = typeOption?.icon ?? IconCheckbox
                  return (
                    <>
                      <TypeIcon
                        className={cn("h-3.5 w-3.5", typeOption?.color ?? "text-gray-500")}
                      />
                      <span className="text-sm capitalize">{formValues.issueType}</span>
                    </>
                  )
                })()}
              </div>
            : <ButtonGroup responsive size="sm">
                {issueTypeOptions.map(t => {
                  const Icon = t.icon
                  const isSelected = formValues.issueType === t.value
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => onUpdateIssueType(t.value)}
                      className={cn(
                        "flex h-full items-center justify-center gap-1 px-2 transition-colors",
                        isSelected ?
                          cn("text-white", t.selectedBg)
                        : cn(t.color, t.unselectedBg, t.unselectedHover),
                      )}
                      aria-pressed={isSelected}
                    >
                      <Icon className="h-3 w-3 shrink-0" />
                      <span data-label>{t.label}</span>
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
            : <TaskRelationCombobox
                task={task}
                allTasks={allTasks}
                issuePrefix={issuePrefix}
                relationType="parent"
                selectedValue={formValues.parent}
                showSelectedValue
                onSelect={onUpdateParent}
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
                  className="bg-muted text-muted-foreground inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-medium"
                >
                  {label}
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => onRemoveLabel(label)}
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
                  onClick={() => onSetShowLabelInput(true)}
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
                    onChange={e => onSetNewLabel(e.target.value)}
                    onKeyDown={handleLabelInputKeyDown}
                    onBlur={() => {
                      if (!newLabel.trim()) {
                        onSetShowLabelInput(false)
                      }
                    }}
                    placeholder="Label name"
                    className="h-7 w-24 px-2.5 text-sm"
                    disabled={isAddingLabel}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2"
                    onClick={onAddLabel}
                    disabled={!newLabel.trim() || isAddingLabel}
                  >
                    Add
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Session Links - links to session logs for this task */}
        {renderSessionLinks ? renderSessionLinks(task.id) : null}

        {/* Related Tasks (text list - children and blockers) */}
        <RelatedTasks
          taskId={task.id}
          task={task}
          readOnly={readOnly}
          allTasks={allTasks}
          issuePrefix={issuePrefix}
        />

        {/* Comments Section - more space */}
        <CommentsSection
          taskId={task.id}
          comments={comments}
          isLoading={isLoadingComments}
          error={commentsError}
          readOnly={readOnly}
          onAddComment={onAddComment}
        />
      </div>

      {!readOnly && (
        <div className="flex shrink-0 flex-col gap-2 border-t p-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Delete section - left side */}
          {canDelete && (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                {isConfirmingDelete ?
                  <>
                    <span className="text-destructive text-sm">Delete this task?</span>
                    <ButtonGroup>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={onConfirmDelete}
                        disabled={isDeleting}
                      >
                        {isDeleting ? "Deleting..." : "Yes, delete"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={onCancelDelete}
                        disabled={isDeleting}
                      >
                        Cancel
                      </Button>
                    </ButtonGroup>
                  </>
                : <Button
                    variant="ghost"
                    size="sm"
                    onClick={onStartDelete}
                    disabled={isSaving}
                    className="text-muted-foreground hover:bg-destructive hover:text-white"
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

// Configuration constants

/** Configuration options for issue type selector buttons. */
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
    selectedBg: "bg-status-success",
    unselectedBg: "bg-transparent",
    unselectedHover: "hover:bg-status-success/20",
  },
  {
    value: "bug",
    label: "Bug",
    icon: IconBug,
    color: "text-status-error",
    selectedBg: "bg-status-error",
    unselectedBg: "bg-transparent",
    unselectedHover: "hover:bg-status-error/20",
  },
  {
    value: "epic",
    label: "Epic",
    icon: IconStack2,
    color: "text-status-info",
    selectedBg: "bg-status-info",
    unselectedBg: "bg-transparent",
    unselectedHover: "hover:bg-status-info/20",
  },
]

/** Configuration for task status display (icons, labels, and colors). */
const statusConfig: Record<TaskStatus, StatusConfig> = {
  open: {
    icon: IconCircle,
    label: "Open",
    color: "text-status-success",
    selectedBg: "bg-status-success",
    unselectedBg: "bg-transparent",
    unselectedHover: "hover:bg-status-success/20",
  },
  in_progress: {
    icon: IconCircleDot,
    label: "In Progress",
    color: "text-status-info",
    selectedBg: "bg-status-info",
    unselectedBg: "bg-transparent",
    unselectedHover: "hover:bg-status-info/20",
  },
  blocked: {
    icon: IconBan,
    label: "Blocked",
    color: "text-status-error",
    selectedBg: "bg-status-error",
    unselectedBg: "bg-transparent",
    unselectedHover: "hover:bg-status-error/20",
  },
  deferred: {
    icon: IconClock,
    label: "Deferred",
    color: "text-status-warning",
    selectedBg: "bg-status-warning",
    unselectedBg: "bg-transparent",
    unselectedHover: "hover:bg-status-warning/20",
  },
  closed: {
    icon: IconCircleCheck,
    label: "Closed",
    color: "text-status-neutral",
    selectedBg: "bg-status-neutral",
    unselectedBg: "bg-transparent",
    unselectedHover: "hover:bg-status-neutral/20",
  },
}

/** Available task status values for the status selector. */
const statusOptions: TaskStatus[] = ["open", "in_progress", "blocked", "deferred", "closed"]

/** Configuration options for priority selector buttons. */
const priorityOptions = [
  {
    value: 0,
    label: "P0 - Critical",
    short: "P0",
    color: "text-red-600",
    selectedBg: "bg-red-600",
    unselectedBg: "bg-transparent",
    unselectedHover: "hover:bg-red-600/20",
  },
  {
    value: 1,
    label: "P1 - High",
    short: "P1",
    color: "text-orange-500",
    selectedBg: "bg-orange-500",
    unselectedBg: "bg-transparent",
    unselectedHover: "hover:bg-orange-500/20",
  },
  {
    value: 2,
    label: "P2 - Medium",
    short: "P2",
    color: "text-amber-500",
    selectedBg: "bg-amber-500",
    unselectedBg: "bg-transparent",
    unselectedHover: "hover:bg-amber-500/20",
  },
  {
    value: 3,
    label: "P3 - Low",
    short: "P3",
    color: "text-yellow-500",
    selectedBg: "bg-yellow-500",
    unselectedBg: "bg-transparent",
    unselectedHover: "hover:bg-yellow-500/20",
  },
  {
    value: 4,
    label: "P4 - Lowest",
    short: "P4",
    color: "text-gray-500",
    selectedBg: "bg-gray-500",
    unselectedBg: "bg-transparent",
    unselectedHover: "hover:bg-gray-500/20",
  },
]

// Types

/** Props for TaskDetails presentational component. */
export type TaskDetailsProps = {
  /** The task being displayed/edited */
  task: Task | null
  /** Whether the dialog is open */
  open: boolean
  /** Whether the component is in read-only mode */
  readOnly?: boolean
  /** Current form values */
  formValues: TaskFormValues
  /** Current labels */
  labels: string[]
  /** Issue prefix for display */
  issuePrefix: string | null
  /** All tasks for parent selection */
  allTasks: Task[]
  /** Whether a save is in progress */
  isSaving: boolean
  /** Whether a delete is in progress */
  isDeleting: boolean
  /** Whether a label is being added */
  isAddingLabel: boolean
  /** Whether delete confirmation is showing */
  isConfirmingDelete: boolean
  /** Delete error message */
  deleteError: string | null
  /** New label input value */
  newLabel: string
  /** Whether label input is showing */
  showLabelInput: boolean
  /** Current comments */
  comments: Comment[]
  /** Whether comments are loading */
  isLoadingComments: boolean
  /** Comments error message */
  commentsError: string | null
  /** Whether delete is allowed */
  canDelete: boolean
  /** Handler for title changes */
  onUpdateTitle: (title: string) => void
  /** Handler for description changes */
  onUpdateDescription: (description: string) => void
  /** Handler for status changes */
  onUpdateStatus: (status: TaskStatus) => void
  /** Handler for priority changes */
  onUpdatePriority: (priority: number) => void
  /** Handler for issue type changes */
  onUpdateIssueType: (issueType: IssueType) => void
  /** Handler for parent changes */
  onUpdateParent: (parent: string | null) => void
  /** Handler for new label input changes */
  onSetNewLabel: (label: string) => void
  /** Handler for showing/hiding label input */
  onSetShowLabelInput: (show: boolean) => void
  /** Handler for adding a label */
  onAddLabel: () => void
  /** Handler for removing a label */
  onRemoveLabel: (label: string) => void
  /** Handler for adding a comment */
  onAddComment: (comment: string) => Promise<void>
  /** Handler for starting delete confirmation */
  onStartDelete: () => void
  /** Handler for canceling delete */
  onCancelDelete: () => void
  /** Handler for confirming delete */
  onConfirmDelete: () => void
  /** Handler for closing the dialog */
  onClose: () => void
  /** Optional custom renderer for the description editor */
  renderDescriptionEditor?: (options: DescriptionEditorOptions) => ReactNode
  /** Optional renderer for session links */
  renderSessionLinks?: (taskId: string) => ReactNode
}

/** Options for rendering a custom description editor. */
export type DescriptionEditorOptions = {
  /** Description value */
  value: string
  /** Handler for description changes */
  onChange: (value: string) => void
  /** Placeholder text */
  placeholder?: string
}

type StatusConfig = {
  icon: TablerIcon
  label: string
  color: string
  selectedBg: string
  unselectedBg: string
  unselectedHover: string
}
