import { useCallback, useEffect, useRef, useState } from "react"
import { IconSend2 } from "@tabler/icons-react"

export type ChatInputProps = {
  onSend: (message: string) => void
  disabled?: boolean
  isStreaming?: boolean
  placeholder?: string
}

/**
 * Chat input with auto-resizing textarea and send button.
 * Submits on Enter (Shift+Enter for newline).
 */
export function ChatInput({
  onSend,
  disabled = false,
  isStreaming = false,
  placeholder = "Send a message…",
}: ChatInputProps) {
  const [value, setValue] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  /** Focus the textarea on mount and after each send. */
  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  const handleSend = useCallback(() => {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setValue("")
    // Reset textarea height and re-focus
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.focus()
    }
  }, [value, disabled, onSend])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend],
  )

  const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value)
    // Auto-resize
    const el = e.target
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [])

  const canSend = value.trim().length > 0 && !disabled

  return (
    <div className="flex items-end gap-2 border-t border-border bg-background px-4 py-3">
      {isStreaming && (
        <div className="flex h-10 items-center">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
        </div>
      )}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        rows={1}
        className="max-h-[200px] min-h-[40px] flex-1 resize-none rounded-lg border border-border bg-muted px-3 py-2 font-sans text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/40"
      />
      <button
        onClick={handleSend}
        disabled={!canSend}
        title="Send message"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-30 disabled:hover:bg-primary"
      >
        <IconSend2 size={18} stroke={1.5} />
      </button>
    </div>
  )
}
