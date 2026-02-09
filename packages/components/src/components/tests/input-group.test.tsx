import { render, screen } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "../input-group"

describe("InputGroup", () => {
  it("renders an input group with role group", () => {
    render(<InputGroup data-testid="ig">Hello</InputGroup>)
    const el = screen.getByTestId("ig")
    expect(el).toHaveAttribute("role", "group")
    expect(el).toHaveAttribute("data-slot", "input-group")
  })

  it("passes className to the group element", () => {
    render(
      <InputGroup data-testid="ig" className="my-custom-class">
        Hello
      </InputGroup>,
    )
    const el = screen.getByTestId("ig")
    expect(el.className).toContain("my-custom-class")
  })
})

describe("InputGroupAddon", () => {
  it("applies inline-start alignment by default", () => {
    render(
      <InputGroupAddon data-testid="addon">
        <span>Icon</span>
      </InputGroupAddon>,
    )
    const el = screen.getByTestId("addon")
    expect(el).toHaveAttribute("data-align", "inline-start")
    expect(el.className).toContain("order-first")
    expect(el.className).toContain("pl-2")
  })

  it("applies inline-end alignment when specified", () => {
    render(
      <InputGroupAddon data-testid="addon" align="inline-end">
        <span>Icon</span>
      </InputGroupAddon>,
    )
    const el = screen.getByTestId("addon")
    expect(el).toHaveAttribute("data-align", "inline-end")
    expect(el.className).toContain("order-last")
    expect(el.className).toContain("pr-2")
  })

  it("applies block-start alignment when specified", () => {
    render(
      <InputGroupAddon data-testid="addon" align="block-start">
        <span>Label</span>
      </InputGroupAddon>,
    )
    const el = screen.getByTestId("addon")
    expect(el).toHaveAttribute("data-align", "block-start")
    expect(el.className).toContain("order-first")
    expect(el.className).toContain("w-full")
  })

  it("applies block-end alignment when specified", () => {
    render(
      <InputGroupAddon data-testid="addon" align="block-end">
        <span>Label</span>
      </InputGroupAddon>,
    )
    const el = screen.getByTestId("addon")
    expect(el).toHaveAttribute("data-align", "block-end")
    expect(el.className).toContain("order-last")
    expect(el.className).toContain("w-full")
  })
})

describe("InputGroupButton", () => {
  it("renders a button with ghost variant by default", () => {
    render(<InputGroupButton>Send</InputGroupButton>)
    const button = screen.getByRole("button")
    expect(button.textContent).toBe("Send")
    expect(button).toHaveAttribute("type", "button")
  })

  it("applies size classes", () => {
    render(<InputGroupButton size="sm">Send</InputGroupButton>)
    const button = screen.getByRole("button")
    expect(button).toHaveAttribute("data-size", "sm")
  })
})

describe("InputGroupInput", () => {
  it("renders an input with data-slot attribute", () => {
    render(<InputGroupInput data-testid="input" placeholder="Type here" />)
    const input = screen.getByTestId("input")
    expect(input).toHaveAttribute("data-slot", "input-group-control")
    expect(input).toHaveAttribute("placeholder", "Type here")
  })
})

describe("InputGroup with button on inline-end", () => {
  it("has sufficient right padding on the addon", () => {
    render(
      <InputGroup>
        <InputGroupInput placeholder="Type..." />
        <InputGroupAddon data-testid="addon" align="inline-end">
          <InputGroupButton>Send</InputGroupButton>
        </InputGroupAddon>
      </InputGroup>,
    )
    const addon = screen.getByTestId("addon")
    // The addon should have pr-2 class for proper right padding
    expect(addon.className).toContain("pr-2")
  })
})
