import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react"
import { IconArrowUp } from "@tabler/icons-react"
import { InputGroup, InputGroupAddon, InputGroupButton } from "@herbcaudill/components"
import { cn } from "../lib/utils"

/**
 * Chat input with auto-resizing textarea and send button.
 * Submits on Enter (Shift+Enter for newline).
 */
export const ChatInput = forwardRef<ChatInputHandle, ChatInputProps>(function ChatInput(
  { onSend, disabled = false, placeholder = "Send a message\u2026" },
  ref,
) {
  const [value, setValue] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
  }))

  /** Focus the textarea on mount and whenever it becomes enabled. */
  useEffect(() => {
    if (!disabled) {
      textareaRef.current?.focus()
    }
  }, [disabled])

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
    <div className="border-t border-border bg-background px-4 py-3">
      <InputGroup data-disabled={disabled}>
        <textarea
          ref={textareaRef}
          data-slot="input-group-control"
          value={value}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          rows={1}
          className={cn(
            "placeholder:text-muted-foreground flex-1 bg-transparent",
            "w-full resize-none border-0 px-3 py-2 text-sm leading-relaxed",
            "focus:ring-0 focus:outline-none",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "max-h-[200px] overflow-auto",
          )}
        />
        <InputGroupAddon align="inline-end" className="self-end pb-2">
          <InputGroupButton
            onClick={handleSend}
            disabled={!canSend}
            title="Send message"
            size="icon-xs"
            variant="default"
          >
            <IconArrowUp className="size-4" />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </div>
  )
})

export type ChatInputHandle = {
  focus: () => void
}

export type ChatInputProps = {
  onSend: (message: string) => void
  disabled?: boolean
  placeholder?: string
}
