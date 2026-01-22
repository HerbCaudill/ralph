import React from "react"
import { describe, it, expect } from "vitest"
import { render } from "ink-testing-library"
import { StreamingText } from "./StreamingText.js"

/**
 * Test suite for StreamingText component
 */
describe("StreamingText", () => {
  /**
   * Verify that plain text without markdown is rendered correctly
   */
  it("renders plain text", () => {
    const { lastFrame } = render(<StreamingText content="Hello world" />)
    const output = lastFrame()
    expect(output).toContain("Hello world")
  })

  /**
   * Verify that text with **bold** markdown is styled correctly
   */
  it("renders bold text", () => {
    const { lastFrame } = render(<StreamingText content="This is **bold** text" />)
    const output = lastFrame()
    expect(output).toContain("This is")
    expect(output).toContain("bold")
    expect(output).toContain("text")
  })

  /**
   * Verify that text with `code` markdown is styled correctly
   */
  it("renders code text", () => {
    const { lastFrame } = render(<StreamingText content="Use `console.log()` to debug" />)
    const output = lastFrame()
    expect(output).toContain("Use")
    expect(output).toContain("console.log()")
    expect(output).toContain("to debug")
  })

  /**
   * Verify that multiple **bold** sections in a single line are handled correctly
   */
  it("renders multiple bold sections", () => {
    const { lastFrame } = render(<StreamingText content="**First** and **Second** bold" />)
    const output = lastFrame()
    expect(output).toContain("First")
    expect(output).toContain("and")
    expect(output).toContain("Second")
    expect(output).toContain("bold")
  })

  /**
   * Verify that multiple `code` sections in a single line are handled correctly
   */
  it("renders multiple code sections", () => {
    const { lastFrame } = render(<StreamingText content="`foo` and `bar` are variables" />)
    const output = lastFrame()
    expect(output).toContain("foo")
    expect(output).toContain("and")
    expect(output).toContain("bar")
    expect(output).toContain("are variables")
  })

  /**
   * Verify that **bold** and `code` can be used together in the same line
   */
  it("renders mixed bold and code", () => {
    const { lastFrame } = render(<StreamingText content="Use **bold** and `code` together" />)
    const output = lastFrame()
    expect(output).toContain("Use")
    expect(output).toContain("bold")
    expect(output).toContain("and")
    expect(output).toContain("code")
    expect(output).toContain("together")
  })

  /**
   * Verify that empty string content is handled gracefully
   */
  it("handles empty string", () => {
    const { lastFrame } = render(<StreamingText content="" />)
    const output = lastFrame()
    expect(output).toBe("")
  })

  /**
   * Verify that unclosed **bold markers are handled gracefully
   */
  it("handles unclosed bold markers", () => {
    const { lastFrame } = render(<StreamingText content="This has **unclosed bold" />)
    const output = lastFrame()
    expect(output).toContain("This has")
    expect(output).toContain("unclosed bold")
  })

  /**
   * Verify that unclosed `code markers are handled gracefully
   */
  it("handles unclosed code markers", () => {
    const { lastFrame } = render(<StreamingText content="This has `unclosed code" />)
    const output = lastFrame()
    expect(output).toContain("This has")
    expect(output).toContain("unclosed code")
  })

  /**
   * Verify that text containing only bold markers (no content) renders as empty
   */
  it("handles text with only bold markers", () => {
    const { lastFrame } = render(<StreamingText content="****" />)
    const output = lastFrame()
    expect(output).toBe("")
  })

  /**
   * Verify that text containing only code markers (no content) renders as empty
   */
  it("handles text with only code markers", () => {
    const { lastFrame } = render(<StreamingText content="``" />)
    const output = lastFrame()
    expect(output).toBe("")
  })

  /**
   * Verify that nested markdown markers (bold inside code) are handled correctly
   */
  it("handles nested-style markers (bold inside code context)", () => {
    const { lastFrame } = render(<StreamingText content="`code with **bold** inside`" />)
    const output = lastFrame()
    // Should treat the whole thing as code since it starts with backtick
    expect(output).toContain("code with")
    expect(output).toContain("bold")
    expect(output).toContain("inside")
  })
})
