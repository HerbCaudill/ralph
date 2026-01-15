import { describe, it, expect, vi } from "vitest"
import React, { useState } from "react"
import { render } from "ink-testing-library"
import { EnhancedTextInput } from "./EnhancedTextInput.js"

// Helper component that manages controlled state
const ControlledInput = ({
  initialValue,
  onValueChange,
  onSubmit,
}: {
  initialValue: string
  onValueChange?: (value: string) => void
  onSubmit?: (value: string) => void
}) => {
  const [value, setValue] = useState(initialValue)
  const handleChange = (newValue: string) => {
    setValue(newValue)
    onValueChange?.(newValue)
  }
  return <EnhancedTextInput value={value} onChange={handleChange} onSubmit={onSubmit} />
}

describe("EnhancedTextInput", () => {
  describe("rendering", () => {
    it("renders with initial value", () => {
      const { lastFrame } = render(
        <EnhancedTextInput value="hello" onChange={vi.fn()} />
      )
      expect(lastFrame()).toContain("hello")
    })

    it("renders placeholder when value is empty", () => {
      const { lastFrame } = render(
        <EnhancedTextInput value="" placeholder="Type here..." onChange={vi.fn()} />
      )
      expect(lastFrame()).toContain("ype here...")
    })
  })

  describe("basic input", () => {
    it("calls onChange when typing", () => {
      const onValueChange = vi.fn()
      const { stdin } = render(
        <ControlledInput initialValue="" onValueChange={onValueChange} />
      )
      stdin.write("a")
      expect(onValueChange).toHaveBeenCalledWith("a")
    })

    it("appends characters when typing multiple characters", () => {
      const onValueChange = vi.fn()
      const { stdin } = render(
        <ControlledInput initialValue="" onValueChange={onValueChange} />
      )
      stdin.write("abc")
      expect(onValueChange).toHaveBeenLastCalledWith("abc")
    })

    it("calls onSubmit when Enter is pressed", () => {
      const onSubmit = vi.fn()
      const { stdin } = render(
        <ControlledInput initialValue="test" onSubmit={onSubmit} />
      )
      stdin.write("\r")
      expect(onSubmit).toHaveBeenCalledWith("test")
    })

    it("handles backspace at end of text", () => {
      const onValueChange = vi.fn()
      const { stdin } = render(
        <ControlledInput initialValue="abc" onValueChange={onValueChange} />
      )
      stdin.write("\x7F") // Backspace
      expect(onValueChange).toHaveBeenCalledWith("ab")
    })
  })

  describe("kill commands (cursor at end)", () => {
    it("handles Ctrl+U to kill entire line when cursor is at end", () => {
      const onValueChange = vi.fn()
      const { stdin } = render(
        <ControlledInput initialValue="hello world" onValueChange={onValueChange} />
      )
      // Cursor starts at end, Ctrl+U should delete everything
      stdin.write("\x15")
      expect(onValueChange).toHaveBeenCalledWith("")
    })

    it("handles Ctrl+K at end (no-op)", () => {
      const onValueChange = vi.fn()
      const { stdin } = render(
        <ControlledInput initialValue="hello" onValueChange={onValueChange} />
      )
      // Cursor starts at end, Ctrl+K should do nothing (no text after cursor)
      stdin.write("\x0B")
      // Since there's nothing after cursor, the value shouldn't change
      // But we need to check it's not called or called with same value
      expect(onValueChange).not.toHaveBeenCalled()
    })
  })

  describe("word deletion (Ctrl+W)", () => {
    it("handles Ctrl+W to delete previous word at end of line", () => {
      const onValueChange = vi.fn()
      const { stdin } = render(
        <ControlledInput initialValue="hello world" onValueChange={onValueChange} />
      )
      // Cursor starts at end
      stdin.write("\x17") // Ctrl+W
      expect(onValueChange).toHaveBeenCalledWith("hello ")
    })

    it("handles Ctrl+W with single word", () => {
      const onValueChange = vi.fn()
      const { stdin } = render(
        <ControlledInput initialValue="hello" onValueChange={onValueChange} />
      )
      stdin.write("\x17") // Ctrl+W
      expect(onValueChange).toHaveBeenCalledWith("")
    })

    it("handles Ctrl+W with trailing spaces", () => {
      const onValueChange = vi.fn()
      const { stdin } = render(
        <ControlledInput initialValue="hello   " onValueChange={onValueChange} />
      )
      stdin.write("\x17") // Ctrl+W
      // Should skip trailing spaces and delete "hello"
      expect(onValueChange).toHaveBeenCalledWith("")
    })
  })

  describe("helper functions", () => {
    // Test the word boundary logic indirectly through Ctrl+W behavior

    it("deletes word correctly when at end", () => {
      const onValueChange = vi.fn()
      const { stdin } = render(
        <ControlledInput initialValue="one two three" onValueChange={onValueChange} />
      )
      stdin.write("\x17") // Ctrl+W - delete "three"
      expect(onValueChange).toHaveBeenCalledWith("one two ")
    })

    it("handles empty string with Ctrl+W", () => {
      const onValueChange = vi.fn()
      const { stdin } = render(
        <ControlledInput initialValue="" onValueChange={onValueChange} />
      )
      stdin.write("\x17") // Ctrl+W - nothing to delete
      expect(onValueChange).not.toHaveBeenCalled()
    })
  })
})
