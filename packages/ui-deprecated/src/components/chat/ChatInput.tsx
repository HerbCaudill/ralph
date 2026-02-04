import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react"
import type { FormEvent, KeyboardEvent } from "react"
import { IconArrowUp } from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group"
import { useAppStore, selectTaskChatInputDraft } from "@/store"
import { TASK_CHAT_INPUT_DRAFT_STORAGE_KEY } from "@/constants"

/**
 * Text area input for sending messages to a running agent.
 * Submits on Enter key (Shift+Enter for new line), clears after send.
 * Supports message history navigation with ArrowUp/ArrowDown keys (like terminal).
 */
export const ChatInput = forwardRef<ChatInputHandle, ChatInputProps>(function ChatInput(
  {
    onSubmit,
    placeholder = "Send Ralph a message...",
    disabled = false,
    className,
    "aria-label": ariaLabel = "Message input",
    storageKey,
  },
  ref,
) {
  // Check if we should use the store (for task chat input draft)
  const useStore = storageKey === TASK_CHAT_INPUT_DRAFT_STORAGE_KEY

  // Get draft from store (only used when useStore is true)
  const taskChatInputDraft = useAppStore(selectTaskChatInputDraft)
  const setTaskChatInputDraft = useAppStore(state => state.setTaskChatInputDraft)

  const [message, setMessage] = useState(() => {
    if (useStore) {
      return taskChatInputDraft
    }
    if (storageKey && typeof window !== "undefined") {
      return localStorage.getItem(storageKey) ?? ""
    }
    return ""
  })
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Message history state - stores all submitted messages
  const [history, setHistory] = useState<string[]>([])
  // Current position in history (-1 means not navigating, at the draft)
  const [historyIndex, setHistoryIndex] = useState(-1)
  // Draft message saved when starting history navigation
  const [savedDraft, setSavedDraft] = useState("")

  /** Persist message when it changes. */
  useEffect(() => {
    if (useStore) {
      // Use store for task chat input draft
      setTaskChatInputDraft(message)
    } else if (storageKey && typeof window !== "undefined") {
      // Fall back to localStorage for other keys
      if (message) {
        localStorage.setItem(storageKey, message)
      } else {
        localStorage.removeItem(storageKey)
      }
    }
  }, [message, storageKey, useStore, setTaskChatInputDraft])

  /** Expose focus and clearHistory methods to parent components via ref. */
  useImperativeHandle(ref, () => ({
    focus: () => {
      textareaRef.current?.focus()
    },
    clearHistory: () => {
      setHistory([])
      setHistoryIndex(-1)
      setSavedDraft("")
    },
  }))

  /**
   * Handle form submission and send the message.
   */
  const handleSubmit = useCallback(
    (
      /** Optional form event */
      e?: FormEvent,
    ) => {
      e?.preventDefault()

      const trimmedMessage = message.trim()
      if (!trimmedMessage || disabled) return

      // Add message to history
      setHistory(prev => [...prev, trimmedMessage])

      // Reset history navigation state
      setHistoryIndex(-1)
      setSavedDraft("")

      onSubmit?.(trimmedMessage)
      setMessage("")
    },
    [message, disabled, onSubmit],
  )

  /**
   * Handle keydown events on the textarea.
   * - Enter: Submit message
   * - Shift+Enter: New line
   * - ArrowUp: Navigate to previous message in history
   * - ArrowDown: Navigate to next message in history
   * - Escape: Clear input or exit history navigation
   */
  const handleKeyDown = useCallback(
    (
      /** Keyboard event from the textarea */
      e: KeyboardEvent<HTMLTextAreaElement>,
    ) => {
      const textarea = textareaRef.current
      const inputValue = textarea?.value ?? ""
      const cursorAtStart = textarea?.selectionStart === 0 && textarea?.selectionEnd === 0

      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        handleSubmit()
        return
      }

      // ArrowUp: Navigate to older messages in history
      // - When not navigating (historyIndex === -1): only trigger if cursor is at start
      // - When already navigating: always allow moving to older messages
      if (e.key === "ArrowUp" && history.length > 0) {
        const canNavigate = historyIndex !== -1 || cursorAtStart
        if (canNavigate) {
          e.preventDefault()

          if (historyIndex === -1) {
            // Starting navigation - save current input as draft
            setSavedDraft(inputValue)
            // Go to most recent message
            setHistoryIndex(history.length - 1)
            setMessage(history[history.length - 1])
          } else if (historyIndex > 0) {
            // Move to older message
            setHistoryIndex(historyIndex - 1)
            setMessage(history[historyIndex - 1])
          }
          // If at oldest message, stay there
          return
        }
      }

      // ArrowDown: Navigate to newer messages in history
      // - Only active when navigating history (historyIndex !== -1)
      // - When not navigating and cursor at end, no action needed
      if (e.key === "ArrowDown" && historyIndex !== -1) {
        e.preventDefault()

        if (historyIndex < history.length - 1) {
          // Move to newer message
          setHistoryIndex(historyIndex + 1)
          setMessage(history[historyIndex + 1])
        } else {
          // At newest message, return to draft
          setHistoryIndex(-1)
          setMessage(savedDraft)
        }
        return
      }

      if (e.key === "Escape") {
        e.preventDefault()
        if (historyIndex !== -1) {
          // Exit history navigation and restore draft
          setHistoryIndex(-1)
          setMessage(savedDraft)
        } else if (inputValue) {
          // Clear input when not navigating history
          setMessage("")
        }
        return
      }
    },
    [handleSubmit, history, historyIndex, savedDraft],
  )

  return (
    <form onSubmit={handleSubmit} className={className}>
      <InputGroup data-disabled={disabled} className="border-0 shadow-none">
        <InputGroupTextarea
          ref={textareaRef}
          value={message}
          onChange={e => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className={cn(
            "placeholder:text-muted-foreground min-h-0 py-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
          aria-label={ariaLabel}
        />
        <InputGroupAddon align="inline-end" className="self-end">
          <InputGroupButton
            type="submit"
            disabled={disabled || !message.trim()}
            size="icon-xs"
            className={cn(
              "bg-repo-accent text-repo-accent-foreground rounded-md transition-opacity hover:opacity-90",
            )}
            aria-label="Send message"
          >
            <IconArrowUp className="size-4" aria-hidden="true" />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </form>
  )
})

export type ChatInputProps = {
  /** Optional callback fired when a message is submitted */
  onSubmit?: (message: string) => void
  /** Placeholder text for the input */
  placeholder?: string
  /** Whether the input is disabled */
  disabled?: boolean
  /** Optional CSS class name to apply to the form */
  className?: string
  /** ARIA label for accessibility */
  "aria-label"?: string
  /** localStorage key to persist input text. If not provided, text is not persisted. */
  storageKey?: string
}

export type ChatInputHandle = {
  /** Focus the input element */
  focus: () => void
  /** Clear the message history */
  clearHistory: () => void
}
