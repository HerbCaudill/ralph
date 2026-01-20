import React from "react"
import { describe, it, expect } from "vitest"
import { render } from "ink-testing-library"
import { StreamingText } from "./StreamingText.js"

describe("StreamingText", () => {
  it("renders plain text", () => {
    const { lastFrame } = render(<StreamingText content="Hello world" />)
    const output = lastFrame()
    expect(output).toContain("Hello world")
  })

  it("renders bold text", () => {
    const { lastFrame } = render(<StreamingText content="This is **bold** text" />)
    const output = lastFrame()
    expect(output).toContain("This is")
    expect(output).toContain("bold")
    expect(output).toContain("text")
  })

  it("renders code text", () => {
    const { lastFrame } = render(<StreamingText content="Use `console.log()` to debug" />)
    const output = lastFrame()
    expect(output).toContain("Use")
    expect(output).toContain("console.log()")
    expect(output).toContain("to debug")
  })

  it("renders multiple bold sections", () => {
    const { lastFrame } = render(<StreamingText content="**First** and **Second** bold" />)
    const output = lastFrame()
    expect(output).toContain("First")
    expect(output).toContain("and")
    expect(output).toContain("Second")
    expect(output).toContain("bold")
  })

  it("renders multiple code sections", () => {
    const { lastFrame } = render(<StreamingText content="`foo` and `bar` are variables" />)
    const output = lastFrame()
    expect(output).toContain("foo")
    expect(output).toContain("and")
    expect(output).toContain("bar")
    expect(output).toContain("are variables")
  })

  it("renders mixed bold and code", () => {
    const { lastFrame } = render(<StreamingText content="Use **bold** and `code` together" />)
    const output = lastFrame()
    expect(output).toContain("Use")
    expect(output).toContain("bold")
    expect(output).toContain("and")
    expect(output).toContain("code")
    expect(output).toContain("together")
  })

  it("handles empty string", () => {
    const { lastFrame } = render(<StreamingText content="" />)
    const output = lastFrame()
    expect(output).toBe("")
  })

  it("handles unclosed bold markers", () => {
    const { lastFrame } = render(<StreamingText content="This has **unclosed bold" />)
    const output = lastFrame()
    expect(output).toContain("This has")
    expect(output).toContain("unclosed bold")
  })

  it("handles unclosed code markers", () => {
    const { lastFrame } = render(<StreamingText content="This has `unclosed code" />)
    const output = lastFrame()
    expect(output).toContain("This has")
    expect(output).toContain("unclosed code")
  })

  it("handles text with only bold markers", () => {
    const { lastFrame } = render(<StreamingText content="****" />)
    const output = lastFrame()
    expect(output).toBe("")
  })

  it("handles text with only code markers", () => {
    const { lastFrame } = render(<StreamingText content="``" />)
    const output = lastFrame()
    expect(output).toBe("")
  })

  it("handles nested-style markers (bold inside code context)", () => {
    const { lastFrame } = render(<StreamingText content="`code with **bold** inside`" />)
    const output = lastFrame()
    // Should treat the whole thing as code since it starts with backtick
    expect(output).toContain("code with")
    expect(output).toContain("bold")
    expect(output).toContain("inside")
  })
})
