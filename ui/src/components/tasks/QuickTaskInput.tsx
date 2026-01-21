import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react"
import type { FormEvent, KeyboardEvent } from "react"
import { IconArrowUp, IconLoader } from "@tabler/icons-react"
import { cn, getContrastingColor } from "@/lib/utils"
import { useAppStore, selectAccentColor } from "@/store"
import { DEFAULT_INPUT_ACCENT_COLOR, TASK_INPUT_DRAFT_STORAGE_KEY } from "@/constants"

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
    const buttonBgColor = accentColor ?? DEFAULT_INPUT_ACCENT_COLOR
    const buttonTextColor = getContrastingColor(buttonBgColor)

    const [title, setTitle] = useState(() => {
      if (typeof window !== "undefined") {
        return localStorage.getItem(TASK_INPUT_DRAFT_STORAGE_KEY) ?? ""
      }
      return ""
    })
    const [isSubmitting, setIsSubmitting] = useState(false)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const shouldRefocusRef = useRef(false)

    const adjustTextareaHeight = useCallback(() => {
      const textarea = textareaRef.current
      if (!textarea) return

      textarea.style.height = "auto"
      textarea.style.height = `${textarea.scrollHeight}px`
    }, [])

    useEffect(() => {
      adjustTextareaHeight()
    }, [title, adjustTextareaHeight])

    useEffect(() => {
      if (typeof window !== "undefined") {
        if (title) {
          localStorage.setItem(TASK_INPUT_DRAFT_STORAGE_KEY, title)
        } else {
          localStorage.removeItem(TASK_INPUT_DRAFT_STORAGE_KEY)
        }
      }
    }, [title])

    useImperativeHandle(ref, () => ({
      focus: () => {
        textareaRef.current?.focus()
      },
    }))

    useEffect(() => {
      if (!isSubmitting && shouldRefocusRef.current) {
        shouldRefocusRef.current = false
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

          localStorage.removeItem(TASK_INPUT_DRAFT_STORAGE_KEY)
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
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault()
          handleSubmit()
        }
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
          aria-label="New task title"
          rows={1}
          className={cn(
            "placeholder:text-muted-foreground bg-transparent",
            "w-full resize-none border-0 px-0 py-1 text-sm",
            "focus:ring-0 focus:outline-none",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "overflow-hidden",
          )}
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
            aria-label={isSubmitting ? "Creating task" : "Add task"}
          >
            {isSubmitting ?
              <IconLoader className="size-5 animate-spin" />
            : <IconArrowUp className="size-5" />}
          </button>
        </div>
      </form>
    )
  },
)

export type QuickTaskInputProps = {
  onTaskCreated?: (issue: CreatedIssue) => void
  onError?: (error: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export type CreatedIssue = {
  id: string
  title: string
  status: string
  priority: number
  issue_type: string
}

export type QuickTaskInputHandle = {
  focus: () => void
}
