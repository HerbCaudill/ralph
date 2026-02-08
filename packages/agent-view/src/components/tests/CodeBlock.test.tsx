import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { AgentViewProvider } from "../../context/AgentViewProvider"
import { CodeBlock } from "../CodeBlock"

describe("CodeBlock", () => {
  it("renders a copy button using the shared Button component", async () => {
    render(
      <AgentViewProvider value={{}}>
        <CodeBlock code="const x = 1" language="typescript" />
      </AgentViewProvider>,
    )

    const copyButton = await screen.findByRole("button", { name: "Copy code" })
    expect(copyButton).toBeDefined()

    // The Button component from @herbcaudill/components sets data-slot="button"
    expect(copyButton.getAttribute("data-slot")).toBe("button")
    // It should have variant="ghost" and size="icon-xs"
    expect(copyButton.getAttribute("data-variant")).toBe("ghost")
    expect(copyButton.getAttribute("data-size")).toBe("icon-xs")
  })

  it("shows check icon after clicking copy", async () => {
    // Mock clipboard API
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, {
      clipboard: { writeText },
    })

    render(
      <AgentViewProvider value={{}}>
        <CodeBlock code="const x = 1" language="typescript" />
      </AgentViewProvider>,
    )

    const copyButton = await screen.findByRole("button", { name: "Copy code" })
    fireEvent.click(copyButton)

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Copied" })).toBeDefined()
    })
    expect(writeText).toHaveBeenCalledWith("const x = 1")
  })

  it("hides copy button when showCopy is false", async () => {
    render(
      <AgentViewProvider value={{}}>
        <CodeBlock code="const x = 1" showCopy={false} />
      </AgentViewProvider>,
    )

    // Wait for the component to render
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Copy code" })).toBeNull()
    })
  })
})
