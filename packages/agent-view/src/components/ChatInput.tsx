import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react"
import { IconArrowUp } from "@tabler/icons-react"
import { InputGroup, InputGroupAddon, InputGroupButton } from "@herbcaudill/components"
import { cn } from "../lib/utils"

/**
 * Reads draft from localStorage, returns empty string if not found.
 */
function readDraft(storageKey: string | undefined): string {
  if (!storageKey) return ""
  try {
    return localStorage.getItem(storageKey) ?? ""
  } catch {
    return ""
  }
}

/**
 * Writes draft to localStorage.
 */
function writeDraft(storageKey: string | undefined, value: string): void {
  if (!storageKey) return
  try {
    localStorage.setItem(storageKey, value)
  } catch {
    // Ignore localStorage errors (e.g., quota exceeded)
  }
}

/**
 * Chat input with auto-resizing textarea and send button.
 * Submits on Enter (Shift+Enter for newline).
 *
 * When storageKey is provided, the input value is persisted to localStorage
 * so drafts survive page reloads.
 */
export const ChatInput = forwardRef<ChatInputHandle, ChatInputProps>(function ChatInput(
  { onSend, onEscape, disabled = false, placeholder = "Send a message\u2026", storageKey },
  ref,
) {
  const [value, setValue] = useState(() => readDraft(storageKey))
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
  }))

  /** Sync value from localStorage when storageKey changes. */
  useEffect(() => {
    setValue(readDraft(storageKey))
  }, [storageKey])

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
    writeDraft(storageKey, "")
    // Reset textarea height and re-focus
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.focus()
    }
  }, [value, disabled, onSend, storageKey])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      } else if (e.key === "Escape") {
        e.preventDefault()
        onEscape?.()
        textareaRef.current?.blur()
      }
    },
    [handleSend, onEscape],
  )

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value
      setValue(newValue)
      writeDraft(storageKey, newValue)
      // Auto-resize
      const el = e.target
      el.style.height = "auto"
      el.style.height = `${Math.min(el.scrollHeight, 200)}px`
    },
    [storageKey],
  )

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
  /** Called when Escape key is pressed. Useful for pausing an agent or dismissing the input. */
  onEscape?: () => void
  disabled?: boolean
  placeholder?: string
  /** Optional localStorage key for persisting draft messages across reloads. */
  storageKey?: string
}
