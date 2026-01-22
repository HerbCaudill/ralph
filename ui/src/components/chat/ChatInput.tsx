import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react"
import type { FormEvent, KeyboardEvent } from "react"
import { IconArrowUp } from "@tabler/icons-react"
import { cn, getContrastingColor } from "@/lib/utils"
import { useAppStore, selectAccentColor } from "@/store"
import { DEFAULT_INPUT_ACCENT_COLOR } from "@/constants"

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
  const accentColor = useAppStore(selectAccentColor)
  const buttonBgColor = accentColor ?? DEFAULT_INPUT_ACCENT_COLOR
  const buttonTextColor = getContrastingColor(buttonBgColor)

  const [message, setMessage] = useState(() => {
    if (storageKey && typeof window !== "undefined") {
      return localStorage.getItem(storageKey) ?? ""
    }
    return ""
  })
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    textarea.style.height = "auto"
    textarea.style.height = `${textarea.scrollHeight}px`
  }, [])

  useEffect(() => {
    adjustTextareaHeight()
  }, [message, adjustTextareaHeight])

  // Persist message to localStorage when it changes
  useEffect(() => {
    if (storageKey && typeof window !== "undefined") {
      if (message) {
        localStorage.setItem(storageKey, message)
      } else {
        localStorage.removeItem(storageKey)
      }
    }
  }, [message, storageKey])

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
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        handleSubmit()
      }
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
          "overflow-hidden",
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

export type ChatInputProps = {
  onSubmit?: (message: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  "aria-label"?: string
  /** localStorage key to persist input text. If not provided, text is not persisted. */
  storageKey?: string
}

export type ChatInputHandle = {
  focus: () => void
}
