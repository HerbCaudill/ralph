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

  /** Expose focus method to parent components via ref. */
  useImperativeHandle(ref, () => ({
    focus: () => {
      textareaRef.current?.focus()
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

      onSubmit?.(trimmedMessage)
      setMessage("")
    },
    [message, disabled, onSubmit],
  )

  /**
   * Handle keydown events on the textarea, specifically Enter key for submission.
   */
  const handleKeyDown = useCallback(
    (
      /** Keyboard event from the textarea */
      e: KeyboardEvent<HTMLTextAreaElement>,
    ) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit],
  )

  return (
    <form onSubmit={handleSubmit} className={className}>
      <InputGroup data-disabled={disabled}>
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
}
