import React, { useState, useEffect } from "react"
import { Text, useInput } from "ink"
import chalk from "chalk"

type Props = {
  value: string
  placeholder?: string
  focus?: boolean
  showCursor?: boolean
  onChange: (value: string) => void
  onSubmit?: (value: string) => void
}

/**
 * Find the start of the previous word from cursor position.
 * A word is a sequence of non-whitespace characters.
 */
const findPreviousWordBoundary = (text: string, cursorOffset: number): number => {
  if (cursorOffset <= 0) return 0

  let pos = cursorOffset

  // Skip any whitespace immediately before cursor
  while (pos > 0 && /\s/.test(text[pos - 1]!)) {
    pos--
  }

  // Skip the word (non-whitespace) characters
  while (pos > 0 && !/\s/.test(text[pos - 1]!)) {
    pos--
  }

  return pos
}

/**
 * Find the end of the next word from cursor position.
 * A word is a sequence of non-whitespace characters.
 */
const findNextWordBoundary = (text: string, cursorOffset: number): number => {
  if (cursorOffset >= text.length) return text.length

  let pos = cursorOffset

  // Skip any whitespace immediately after cursor
  while (pos < text.length && /\s/.test(text[pos]!)) {
    pos++
  }

  // Skip the word (non-whitespace) characters
  while (pos < text.length && !/\s/.test(text[pos]!)) {
    pos++
  }

  return pos
}

/**
 * Enhanced text input component with standard text editing shortcuts:
 * - Option+Left/Right: Move cursor by word
 * - Option+Backspace: Delete previous word
 * - Ctrl+A: Move to beginning of line
 * - Ctrl+E: Move to end of line
 * - Ctrl+K: Kill (delete) from cursor to end of line
 * - Ctrl+U: Kill (delete) from cursor to beginning of line
 * - Ctrl+W: Delete previous word
 */
export const EnhancedTextInput = ({
  value: originalValue,
  placeholder = "",
  focus = true,
  showCursor = true,
  onChange,
  onSubmit,
}: Props) => {
  const [cursorOffset, setCursorOffset] = useState(originalValue.length)

  useEffect(() => {
    if (!focus || !showCursor) {
      return
    }
    // Ensure cursor stays within bounds when value changes externally
    if (cursorOffset > originalValue.length) {
      setCursorOffset(originalValue.length)
    }
  }, [originalValue, focus, showCursor, cursorOffset])

  // Render the value with cursor
  let renderedValue = originalValue
  let renderedPlaceholder = placeholder ? chalk.grey(placeholder) : undefined

  if (showCursor && focus) {
    renderedPlaceholder =
      placeholder.length > 0
        ? chalk.inverse(placeholder[0]) + chalk.grey(placeholder.slice(1))
        : chalk.inverse(" ")

    renderedValue = originalValue.length > 0 ? "" : chalk.inverse(" ")

    for (let i = 0; i < originalValue.length; i++) {
      const char = originalValue[i]!
      renderedValue += i === cursorOffset ? chalk.inverse(char) : char
    }

    if (originalValue.length > 0 && cursorOffset === originalValue.length) {
      renderedValue += chalk.inverse(" ")
    }
  }

  useInput(
    (input, key) => {
      // Ignore control sequences we don't handle
      if (key.upArrow || key.downArrow || (key.ctrl && input === "c") || key.tab) {
        return
      }

      if (key.return) {
        onSubmit?.(originalValue)
        return
      }

      let nextCursorOffset = cursorOffset
      let nextValue = originalValue

      // Option+Left: Move cursor to previous word boundary
      if (key.meta && key.leftArrow) {
        nextCursorOffset = findPreviousWordBoundary(originalValue, cursorOffset)
      }
      // Option+Right: Move cursor to next word boundary
      else if (key.meta && key.rightArrow) {
        nextCursorOffset = findNextWordBoundary(originalValue, cursorOffset)
      }
      // Ctrl+A: Move to beginning of line
      else if (key.ctrl && input === "a") {
        nextCursorOffset = 0
      }
      // Ctrl+E: Move to end of line
      else if (key.ctrl && input === "e") {
        nextCursorOffset = originalValue.length
      }
      // Ctrl+K: Kill from cursor to end of line
      else if (key.ctrl && input === "k") {
        nextValue = originalValue.slice(0, cursorOffset)
        // Cursor stays in place
      }
      // Ctrl+U: Kill from cursor to beginning of line
      else if (key.ctrl && input === "u") {
        nextValue = originalValue.slice(cursorOffset)
        nextCursorOffset = 0
      }
      // Ctrl+W or Option+Backspace: Delete previous word
      else if (key.ctrl && input === "w") {
        const wordStart = findPreviousWordBoundary(originalValue, cursorOffset)
        nextValue = originalValue.slice(0, wordStart) + originalValue.slice(cursorOffset)
        nextCursorOffset = wordStart
      }
      // Option+Backspace (sent as meta + backspace)
      else if (key.meta && key.backspace) {
        const wordStart = findPreviousWordBoundary(originalValue, cursorOffset)
        nextValue = originalValue.slice(0, wordStart) + originalValue.slice(cursorOffset)
        nextCursorOffset = wordStart
      }
      // Regular left arrow
      else if (key.leftArrow) {
        if (showCursor && cursorOffset > 0) {
          nextCursorOffset = cursorOffset - 1
        }
      }
      // Regular right arrow
      else if (key.rightArrow) {
        if (showCursor && cursorOffset < originalValue.length) {
          nextCursorOffset = cursorOffset + 1
        }
      }
      // Backspace
      else if (key.backspace || key.delete) {
        if (cursorOffset > 0) {
          nextValue =
            originalValue.slice(0, cursorOffset - 1) + originalValue.slice(cursorOffset)
          nextCursorOffset = cursorOffset - 1
        }
      }
      // Regular character input
      else if (input && !key.ctrl && !key.meta) {
        nextValue =
          originalValue.slice(0, cursorOffset) + input + originalValue.slice(cursorOffset)
        nextCursorOffset = cursorOffset + input.length
      }

      // Clamp cursor to valid range
      nextCursorOffset = Math.max(0, Math.min(nextCursorOffset, nextValue.length))

      setCursorOffset(nextCursorOffset)

      if (nextValue !== originalValue) {
        onChange(nextValue)
      }
    },
    { isActive: focus }
  )

  return (
    <Text>
      {placeholder
        ? originalValue.length > 0
          ? renderedValue
          : renderedPlaceholder
        : renderedValue}
    </Text>
  )
}
