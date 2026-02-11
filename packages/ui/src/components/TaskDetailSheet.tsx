import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react"
import { TaskDetailsController, updateTask, deleteTask } from "@herbcaudill/beads-view"
import type { TaskCardTask, TaskUpdateData } from "@herbcaudill/beads-view"
import { useUiStore } from "../stores/uiStore"
import { cn } from "../lib/utils"

/**
 * Slide-out panel for task details.
 * Positioned absolutely on the right side of its parent container,
 * overlaying content without a dark backdrop.
 * Dismissible via Escape key or clicking outside.
 */
export function TaskDetailSheet({ task, open, onClose, onChanged }: TaskDetailSheetProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const rawIssueSheetWidthPercent = useUiStore(state => state.issueSheetWidthPercent)
  const setIssueSheetWidthPercent = useUiStore(state => state.setIssueSheetWidthPercent)

  // Clamp stored width to valid bounds to prevent invalid widths from corrupted state
  const issueSheetWidthPercent = clampPercent(rawIssueSheetWidthPercent)

  // Local state for dragging - we track pixels during drag for smoothness
  const [panelWidth, setPanelWidth] = useState(() => percentToPixels(issueSheetWidthPercent))
  const [isResizing, setIsResizing] = useState(false)

  // Keep a ref to panelWidth so document-level handlers always see the latest value
  const panelWidthRef = useRef(panelWidth)
  panelWidthRef.current = panelWidth

  // Sync local state with store when store changes (e.g., on mount from localStorage)
  useEffect(() => {
    setPanelWidth(percentToPixels(issueSheetWidthPercent))
  }, [issueSheetWidthPercent])

  // Update pixel values on window resize to maintain percentage-based layout
  useEffect(() => {
    const handleResize = () => {
      setPanelWidth(percentToPixels(issueSheetWidthPercent))
    }
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [issueSheetWidthPercent])

  const handleResizeMouseDown = useCallback(
    (e: ReactMouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsResizing(true)

      const handleMouseMove = (e: MouseEvent) => {
        const newWidth = Math.min(
          Math.max(e.clientX, MIN_ISSUE_SHEET_WIDTH),
          window.innerWidth * MAX_ISSUE_SHEET_WIDTH_PERCENT,
        )
        setPanelWidth(newWidth)
        panelWidthRef.current = newWidth
      }

      const handleMouseUp = () => {
        setIssueSheetWidthPercent(pixelsToPercent(panelWidthRef.current))
        setIsResizing(false)
        document.removeEventListener("mousemove", handleMouseMove)
        document.removeEventListener("mouseup", handleMouseUp)
      }

      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
    },
    [setIssueSheetWidthPercent],
  )

  const handleSave = useCallback(
    async (id: string, updates: TaskUpdateData) => {
      await updateTask(id, updates)
      onChanged()
    },
    [onChanged],
  )

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteTask(id)
      onChanged()
      onClose()
    },
    [onChanged, onClose],
  )

  // Close on Escape key
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [open, onClose])

  // Close on click outside the panel
  useEffect(() => {
    if (!open || !onClose) return

    const handleOutsideClick = (event: Event) => {
      const target = event.target as HTMLElement
      if (!target) return
      if (panelRef.current?.contains(target)) return
      // Don't close when clicking inside Radix portals (e.g. dropdowns, popovers)
      if (target.closest("[data-radix-popper-content-wrapper]")) return
      onClose()
    }

    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleOutsideClick)
    }, 100)

    return () => {
      clearTimeout(timer)
      document.removeEventListener("mousedown", handleOutsideClick)
    }
  }, [open, onClose])

  const isVisible = open && task !== null

  if (!isVisible) return null

  return (
    <div
      ref={panelRef}
      data-testid="task-detail-sheet"
      className="animate-slide-out-right bg-background absolute top-0 left-0 h-full overflow-hidden border-r border-border shadow-lg"
      style={{ width: panelWidth }}
      onClick={e => e.stopPropagation()}
    >
      <TaskDetailsController
        task={task}
        open={open}
        onClose={onClose}
        onSave={handleSave}
        onDelete={handleDelete}
      />
      {/* Resize handle on the right edge */}
      <div
        data-testid="issue-sheet-resize-handle"
        className={cn(
          "absolute top-0 right-0 h-full w-1 cursor-col-resize transition-colors hover:bg-primary/20",
          isResizing && "bg-primary/30",
        )}
        onMouseDown={handleResizeMouseDown}
      />
    </div>
  )
}

/** Minimum width of the issue sheet in pixels. */
const MIN_ISSUE_SHEET_WIDTH = 300

/** Maximum width of the issue sheet as a percentage of viewport (0.0-1.0). */
const MAX_ISSUE_SHEET_WIDTH_PERCENT = 0.6

/** Clamp a percentage value to the valid range for the issue sheet width. */
function clampPercent(percent: number): number {
  const minPercent = (MIN_ISSUE_SHEET_WIDTH / window.innerWidth) * 100
  const maxPercent = MAX_ISSUE_SHEET_WIDTH_PERCENT * 100
  return Math.min(Math.max(percent, minPercent), maxPercent)
}

/** Convert percentage to pixels based on current viewport width. */
function percentToPixels(percent: number): number {
  return (percent / 100) * window.innerWidth
}

/** Convert pixels to percentage based on current viewport width. */
function pixelsToPercent(pixels: number): number {
  return (pixels / window.innerWidth) * 100
}

export type TaskDetailSheetProps = {
  /** The task to display/edit */
  task: TaskCardTask | null
  /** Whether the sheet is open */
  open: boolean
  /** Callback when close is requested */
  onClose: () => void
  /** Callback when task is changed (updated/deleted) */
  onChanged: () => void
}
