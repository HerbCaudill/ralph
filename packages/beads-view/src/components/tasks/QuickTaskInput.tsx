import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react"
import { flushSync } from "react-dom"
import type { FormEvent, KeyboardEvent } from "react"
import { IconArrowUp, IconLoader } from "@tabler/icons-react"
import { cn } from "../../lib/cn"
import { getContrastingColor } from "../../lib/getContrastingColor"
import { useBeadsViewStore, selectAccentColor, selectTaskInputDraft } from "../../store"
import { DEFAULT_INPUT_ACCENT_COLOR } from "../../constants"
import { InputGroup, InputGroupAddon, InputGroupButton } from "@herbcaudill/components"
import { apiFetch } from "../../lib/apiClient"
import { useState } from "react"

/**
 * Text input for quickly adding tasks.
 * Submits on Enter key (Shift+Enter for new line), calls bd create via API.
 */
export const QuickTaskInput = forwardRef<QuickTaskInputHandle, QuickTaskInputProps>(
  function QuickTaskInput(
    { onTaskCreated, onError, placeholder = "Add a task...", disabled = false, className },
    ref,
  ) {
    const accentColor = useBeadsViewStore(selectAccentColor)
    const buttonBgColor = accentColor ?? DEFAULT_INPUT_ACCENT_COLOR
    const buttonTextColor = getContrastingColor(buttonBgColor)

    // Get draft from store and setter
    const taskInputDraft = useBeadsViewStore(selectTaskInputDraft)
    const setTaskInputDraft = useBeadsViewStore(state => state.setTaskInputDraft)

    // Local state for the input, initialized from store
    const [title, setTitle] = useState(taskInputDraft)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const shouldRefocusRef = useRef(false)

    /**
     * Adjusts textarea height to fit content automatically.
     */
    const adjustTextareaHeight = useCallback(() => {
      const textarea = textareaRef.current
      if (!textarea) return

      textarea.style.height = "auto"
      textarea.style.height = `${textarea.scrollHeight}px`
    }, [])

    /**
     * Adjusts textarea height whenever the title changes.
     */
    useEffect(() => {
      adjustTextareaHeight()
    }, [title, adjustTextareaHeight])

    /**
     * Persists the current input value to the store.
     */
    useEffect(() => {
      setTaskInputDraft(title)
    }, [title, setTaskInputDraft])

    /**
     * Exposes focus method to parent components via ref.
     */
    useImperativeHandle(ref, () => ({
      focus: () => {
        textareaRef.current?.focus()
      },
    }))

    /**
     * Refocuses the textarea after submission completes.
     */
    useEffect(() => {
      if (!isSubmitting && shouldRefocusRef.current) {
        shouldRefocusRef.current = false
        const timer = setTimeout(() => {
          textareaRef.current?.focus()
        }, 0)
        return () => clearTimeout(timer)
      }
    }, [isSubmitting])

    /**
     * Submits the task form, creates a new task via API, and resets the input.
     */
    const handleSubmit = useCallback(
      async (e?: FormEvent) => {
        e?.preventDefault()

        const trimmedTitle = title.trim()
        if (!trimmedTitle || disabled || isSubmitting) return

        setIsSubmitting(true)

        try {
          const response = await apiFetch("/api/tasks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: trimmedTitle }),
          })

          const data = await response.json()

          if (!response.ok) {
            throw new Error(data.error || "Failed to create task")
          }

          // Use flushSync to ensure the title is cleared before any callbacks that might
          // trigger re-renders (like task list refresh). This prevents race conditions.
          flushSync(() => {
            setTitle("")
          })
          shouldRefocusRef.current = true
          // Don't await onTaskCreated - let it run in background
          onTaskCreated?.(data.issue)
        } catch (err) {
          const message = err instanceof Error ? err.message : "Failed to create task"
          onError?.(message)
        } finally {
          setIsSubmitting(false)
        }
      },
      [title, disabled, isSubmitting, onTaskCreated, onError],
    )

    /**
     * Handles Enter key to submit the form (Shift+Enter creates new line).
     */
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
      <form onSubmit={handleSubmit} className={className}>
        <InputGroup data-disabled={isDisabled}>
          <textarea
            ref={textareaRef}
            data-slot="input-group-control"
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={isDisabled}
            aria-label="New task title"
            rows={1}
            className={cn(
              "placeholder:text-muted-foreground flex-1 bg-transparent",
              "w-full resize-none border-0 px-3 py-2 text-sm",
              "focus:ring-0 focus:outline-none",
              "disabled:cursor-not-allowed disabled:opacity-50",
              "overflow-hidden",
            )}
          />
          <InputGroupAddon align="inline-end" className="pr-1.5">
            <InputGroupButton
              type="submit"
              disabled={isDisabled || !title.trim()}
              size="icon-xs"
              className={cn("rounded-md transition-opacity")}
              style={{
                backgroundColor: buttonBgColor,
                color: buttonTextColor,
              }}
              aria-label={isSubmitting ? "Creating task" : "Add task"}
            >
              {isSubmitting ?
                <IconLoader className="size-4 animate-spin" />
              : <IconArrowUp className="size-4" />}
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
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
