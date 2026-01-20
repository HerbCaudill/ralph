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
import { IconArrowUp } from "@tabler/icons-react"

// Constants

/** Default accent color (black) when peacock color is not set */
const DEFAULT_ACCENT_COLOR = "#000000"

// Types

export interface ChatInputProps {
  /**
   * Callback when a message is submitted.
   */
  onSubmit?: (message: string) => void

  /**
   * Placeholder text for the input.
   * @default "Send Ralph a message..."
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

  /**
   * Aria label for the textarea.
   * @default "Message input"
   */
  "aria-label"?: string
}

export interface ChatInputHandle {
  focus: () => void
}

// ChatInput Component

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
  },
  ref,
) {
  const accentColor = useAppStore(selectAccentColor)
  const buttonBgColor = accentColor ?? DEFAULT_ACCENT_COLOR
  const buttonTextColor = getContrastingColor(buttonBgColor)

  const [message, setMessage] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea to fit content
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = "auto"
    // Set height to scrollHeight to fit content
    textarea.style.height = `${textarea.scrollHeight}px`
  }, [])

  // Adjust height when message changes
  useEffect(() => {
    adjustTextareaHeight()
  }, [message, adjustTextareaHeight])

  useImperativeHandle(ref, () => ({
    focus: () => {
      textareaRef.current?.focus()
    },
  }))

  const handleSubmit = useCallback(
    (e?: FormEvent) => {
      e?.preventDefault()

      const trimmedMessage = message.trim()
      if (!trimmedMessage || disabled) return

      onSubmit?.(trimmedMessage)
      setMessage("")
    },
    [message, disabled, onSubmit],
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

  return (
    <form onSubmit={handleSubmit} className={cn("flex flex-col gap-2", className)}>
      <textarea
        ref={textareaRef}
        value={message}
        onChange={e => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        className={cn(
          "placeholder:text-muted-foreground bg-transparent",
          "w-full resize-none border-0 px-0 py-1 text-sm",
          "focus:ring-0 focus:outline-none",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "overflow-hidden", // Hide scrollbar during auto-resize
        )}
        aria-label={ariaLabel}
      />
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={disabled || !message.trim()}
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
          aria-label="Send message"
        >
          <IconArrowUp className="size-5" aria-hidden="true" />
        </button>
      </div>
    </form>
  )
})
