import { cn, getContrastingColor } from "@/lib/utils"
import { useAppStore, selectAccentColor } from "@/store"
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react"
import { IconArrowUp, IconLoader } from "@tabler/icons-react"

// Constants

/** Default accent color (black) when peacock color is not set */
const DEFAULT_ACCENT_COLOR = "#000000"

// Types

export interface QuickTaskInputProps {
  /**
   * Callback when a task is successfully created.
   * Receives the created issue data from bd.
   */
  onTaskCreated?: (issue: CreatedIssue) => void

  /**
   * Callback when task creation fails.
   */
  onError?: (error: string) => void

  /**
   * Placeholder text for the input.
   * @default "Tell Ralph what you want to do"
   */
  placeholder?: string

  /**
   * Whether the input is disabled.
   * @default false
   */
  disabled?: boolean

  /**
   * Additional CSS classes.
   */
  className?: string
}

export interface CreatedIssue {
  id: string
  title: string
  status: string
  priority: number
  issue_type: string
}

export interface QuickTaskInputHandle {
  focus: () => void
}

const STORAGE_KEY = "ralph-ui-task-input-draft"

// QuickTaskInput Component

/**
 * Text input for quickly adding tasks.
 * Submits on Enter key (Shift+Enter for new line), calls bd create via API.
 */
export const QuickTaskInput = forwardRef<QuickTaskInputHandle, QuickTaskInputProps>(
  function QuickTaskInput(
    {
      onTaskCreated,
      onError,
      placeholder = "Tell Ralph what you want to do",
      disabled = false,
      className,
    },
    ref,
  ) {
    const accentColor = useAppStore(selectAccentColor)
    const buttonBgColor = accentColor ?? DEFAULT_ACCENT_COLOR
    const buttonTextColor = getContrastingColor(buttonBgColor)

    const [title, setTitle] = useState(() => {
      // Initialize from localStorage
      if (typeof window !== "undefined") {
        return localStorage.getItem(STORAGE_KEY) ?? ""
      }
      return ""
    })
    const [isSubmitting, setIsSubmitting] = useState(false)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    // Track if we just completed a successful submission to refocus
    const shouldRefocusRef = useRef(false)

    // Persist to localStorage as user types
    useEffect(() => {
      if (typeof window !== "undefined") {
        if (title) {
          localStorage.setItem(STORAGE_KEY, title)
        } else {
          localStorage.removeItem(STORAGE_KEY)
        }
      }
    }, [title])

    useImperativeHandle(ref, () => ({
      focus: () => {
        textareaRef.current?.focus()
      },
    }))

    // Refocus textarea after successful submission
    // This runs after React has finished rendering, ensuring focus is restored
    // even after parent components have updated (e.g., task list refresh)
    useEffect(() => {
      if (!isSubmitting && shouldRefocusRef.current) {
        shouldRefocusRef.current = false
        // Use setTimeout to ensure focus happens after all React updates and
        // parent component re-renders have completed
        const timer = setTimeout(() => {
          textareaRef.current?.focus()
        }, 0)
        return () => clearTimeout(timer)
      }
    }, [isSubmitting])

    const handleSubmit = useCallback(
      async (e?: FormEvent) => {
        e?.preventDefault()

        const trimmedTitle = title.trim()
        if (!trimmedTitle || disabled || isSubmitting) return

        setIsSubmitting(true)

        try {
          const response = await fetch("/api/tasks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: trimmedTitle }),
          })

          const data = await response.json()

          if (!response.ok) {
            throw new Error(data.error || "Failed to create task")
          }

          setTitle("")
          shouldRefocusRef.current = true
          await onTaskCreated?.(data.issue)
        } catch (err) {
          const message = err instanceof Error ? err.message : "Failed to create task"
          onError?.(message)
        } finally {
          setIsSubmitting(false)
        }
      },
      [title, disabled, isSubmitting, onTaskCreated, onError],
    )

    const handleKeyDown = useCallback(
      (e: KeyboardEvent<HTMLTextAreaElement>) => {
        // Enter to submit, Shift+Enter for new line
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault()
          handleSubmit()
        }
        // Shift+Enter allows default behavior (new line)
      },
      [handleSubmit],
    )

    const isDisabled = disabled || isSubmitting

    return (
      <form onSubmit={handleSubmit} className={cn("flex flex-col gap-2", className)}>
        <textarea
          ref={textareaRef}
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isDisabled}
          rows={3}
          className={cn(
            "placeholder:text-muted-foreground bg-transparent",
            "w-full resize-none border-0 px-0 py-1 text-sm",
            "focus:ring-0 focus:outline-none",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
          aria-label="New task title"
        />
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isDisabled || !title.trim()}
            className={cn(
              "inline-flex shrink-0 items-center justify-center rounded-md p-1.5",
              "focus-visible:ring-ring/50 focus:outline-none focus-visible:ring-[3px]",
              "disabled:pointer-events-none disabled:opacity-50",
              "transition-opacity",
            )}
            style={{
              backgroundColor: buttonBgColor,
              color: buttonTextColor,
            }}
            aria-label={isSubmitting ? "Creating task..." : "Add task"}
          >
            {isSubmitting ?
              <IconLoader className="size-4 animate-spin" aria-hidden="true" />
            : <IconArrowUp className="size-5" aria-hidden="true" />}
          </button>
        </div>
      </form>
    )
  },
)
