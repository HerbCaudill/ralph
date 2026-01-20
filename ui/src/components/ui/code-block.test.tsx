import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { CodeBlock } from "./code-block"

describe("CodeBlock", () => {
  // Mock clipboard API
  const mockWriteText = vi.fn()
  const originalClipboard = navigator.clipboard

  beforeEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: mockWriteText },
      writable: true,
      configurable: true,
    })
    mockWriteText.mockResolvedValue(undefined)
  })

  afterEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: originalClipboard,
      writable: true,
      configurable: true,
    })
    vi.clearAllMocks()
  })

  it("renders code content", async () => {
    render(<CodeBlock code="const x = 1;" language="typescript" />)
    // Initially shows loading state with plain code
    expect(screen.getByText("const x = 1;")).toBeInTheDocument()
  })

  it("renders with syntax highlighting", async () => {
    render(<CodeBlock code="const x = 1;" language="typescript" isDark={true} />)

    // Wait for shiki to load and highlight
    await waitFor(
      () => {
        const container = document.querySelector("[class*='shiki']")
        expect(container).toBeInTheDocument()
      },
      { timeout: 5000 },
    )
  })

  it("handles light theme", async () => {
    render(<CodeBlock code="const x = 1;" language="typescript" isDark={false} />)

    // Wait for shiki to load and highlight with light theme
    await waitFor(
      () => {
        const container = document.querySelector("[class*='github-light']")
        expect(container).toBeInTheDocument()
      },
      { timeout: 5000 },
    )
  })

  it("handles dark theme", async () => {
    render(<CodeBlock code="const x = 1;" language="typescript" isDark={true} />)

    // Wait for shiki to load and highlight with dark theme
    await waitFor(
      () => {
        const container = document.querySelector("[class*='github-dark']")
        expect(container).toBeInTheDocument()
      },
      { timeout: 5000 },
    )
  })

  it("handles language aliases", async () => {
    render(<CodeBlock code="const x = 1;" language="ts" isDark={true} />)

    // Should work with "ts" alias for "typescript"
    await waitFor(
      () => {
        const container = document.querySelector("[class*='shiki']")
        expect(container).toBeInTheDocument()
      },
      { timeout: 5000 },
    )
  })

  it("handles unknown languages gracefully", async () => {
    render(<CodeBlock code="some code" language="unknownlanguage" isDark={true} />)

    // Should still render with text fallback
    await waitFor(
      () => {
        const container = document.querySelector("[class*='shiki']")
        expect(container).toBeInTheDocument()
      },
      { timeout: 5000 },
    )
  })

  it("applies custom className", () => {
    const { container } = render(
      <CodeBlock code="const x = 1;" language="typescript" className="custom-class" />,
    )
    // The custom class is on the outermost wrapper
    expect(container.firstChild).toHaveClass("custom-class")
  })

  it("preserves multiline code", async () => {
    const multilineCode = `function test() {
  return 42;
}`
    render(<CodeBlock code={multilineCode} language="javascript" />)

    // Check that the code content is preserved
    expect(screen.getByText(/function test/)).toBeInTheDocument()
    expect(screen.getByText(/return 42/)).toBeInTheDocument()
  })

  describe("copy button", () => {
    it("shows copy button by default", async () => {
      render(<CodeBlock code="const x = 1;" language="typescript" />)

      await waitFor(
        () => {
          const button = screen.getByRole("button", { name: /copy/i })
          expect(button).toBeInTheDocument()
        },
        { timeout: 5000 },
      )
    })

    it("hides copy button when showCopy is false", async () => {
      render(<CodeBlock code="const x = 1;" language="typescript" showCopy={false} />)

      await waitFor(
        () => {
          const container = document.querySelector("[class*='shiki']")
          expect(container).toBeInTheDocument()
        },
        { timeout: 5000 },
      )

      expect(screen.queryByRole("button", { name: /copy/i })).not.toBeInTheDocument()
    })

    it("copies code to clipboard when clicked", async () => {
      const code = "const x = 1;"
      render(<CodeBlock code={code} language="typescript" />)

      await waitFor(
        () => {
          const button = screen.getByRole("button", { name: /copy/i })
          expect(button).toBeInTheDocument()
        },
        { timeout: 5000 },
      )

      const button = screen.getByRole("button", { name: /copy/i })
      fireEvent.click(button)

      expect(mockWriteText).toHaveBeenCalledWith(code)
    })

    it("shows check icon after copying", async () => {
      render(<CodeBlock code="const x = 1;" language="typescript" />)

      await waitFor(
        () => {
          const button = screen.getByRole("button", { name: /copy/i })
          expect(button).toBeInTheDocument()
        },
        { timeout: 5000 },
      )

      const button = screen.getByRole("button", { name: /copy/i })
      fireEvent.click(button)

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /copied/i })).toBeInTheDocument()
      })
    })

    it("reverts to copy icon after delay", async () => {
      render(<CodeBlock code="const x = 1;" language="typescript" />)

      await waitFor(
        () => {
          const button = screen.getByRole("button", { name: /copy/i })
          expect(button).toBeInTheDocument()
        },
        { timeout: 5000 },
      )

      const button = screen.getByRole("button", { name: /copy/i })
      fireEvent.click(button)

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /copied/i })).toBeInTheDocument()
      })

      // Wait for the 2-second timeout to pass and copy icon to return
      await waitFor(
        () => {
          expect(screen.getByRole("button", { name: /copy/i })).toBeInTheDocument()
        },
        { timeout: 3000 },
      )
    })
  })
})
