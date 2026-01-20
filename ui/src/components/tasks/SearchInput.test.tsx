import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { SearchInput, type SearchInputHandle } from "./SearchInput"
import { useAppStore } from "@/store"
import { createRef } from "react"

// Tests

describe("SearchInput", () => {
  beforeEach(() => {
    // Reset the store before each test
    useAppStore.getState().clearTaskSearchQuery()
  })

  afterEach(() => {
    // Clean up
    useAppStore.getState().clearTaskSearchQuery()
  })

  describe("rendering", () => {
    it("renders search input", () => {
      render(<SearchInput />)
      expect(screen.getByRole("textbox", { name: "Search tasks" })).toBeInTheDocument()
    })

    it("renders with custom placeholder", () => {
      render(<SearchInput placeholder="Find something..." />)
      expect(screen.getByPlaceholderText("Find something...")).toBeInTheDocument()
    })

    it("renders with default placeholder", () => {
      render(<SearchInput />)
      expect(screen.getByPlaceholderText("Search tasks...")).toBeInTheDocument()
    })

    it("renders search icon", () => {
      render(<SearchInput />)
      // The search icon is rendered but hidden from screen readers
      const input = screen.getByRole("textbox")
      expect(input.parentElement?.querySelector("svg")).toBeInTheDocument()
    })

    it("applies custom className", () => {
      render(<SearchInput className="custom-class" />)
      expect(screen.getByRole("textbox").parentElement).toHaveClass("custom-class")
    })

    it("can be disabled", () => {
      render(<SearchInput disabled />)
      expect(screen.getByRole("textbox")).toBeDisabled()
    })
  })

  describe("input behavior", () => {
    it("updates store on input change", () => {
      render(<SearchInput />)
      const input = screen.getByRole("textbox")

      fireEvent.change(input, { target: { value: "test query" } })

      expect(useAppStore.getState().taskSearchQuery).toBe("test query")
    })

    it("shows clear button when query is not empty", () => {
      // Set up query first
      useAppStore.getState().setTaskSearchQuery("test")
      render(<SearchInput />)

      expect(screen.getByRole("button", { name: "Clear search" })).toBeInTheDocument()
    })

    it("hides clear button when query is empty", () => {
      render(<SearchInput />)
      expect(screen.queryByRole("button", { name: "Clear search" })).not.toBeInTheDocument()
    })

    it("clears query when clear button is clicked", () => {
      useAppStore.getState().setTaskSearchQuery("test query")
      render(<SearchInput />)

      const clearButton = screen.getByRole("button", { name: "Clear search" })
      fireEvent.click(clearButton)

      expect(useAppStore.getState().taskSearchQuery).toBe("")
    })

    it("clears query on Escape key", () => {
      useAppStore.getState().setTaskSearchQuery("test query")
      render(<SearchInput />)

      const input = screen.getByRole("textbox")
      fireEvent.keyDown(input, { key: "Escape" })

      expect(useAppStore.getState().taskSearchQuery).toBe("")
    })
  })

  describe("ref methods", () => {
    it("focus() focuses the input", () => {
      const ref = createRef<SearchInputHandle>()
      render(<SearchInput ref={ref} />)

      const input = screen.getByRole("textbox")
      expect(document.activeElement).not.toBe(input)

      ref.current?.focus()
      expect(document.activeElement).toBe(input)
    })

    it("clear() clears the query", () => {
      const ref = createRef<SearchInputHandle>()
      useAppStore.getState().setTaskSearchQuery("test query")
      render(<SearchInput ref={ref} />)

      ref.current?.clear()
      expect(useAppStore.getState().taskSearchQuery).toBe("")
    })
  })

  describe("store integration", () => {
    it("displays current store value", () => {
      useAppStore.getState().setTaskSearchQuery("existing query")
      render(<SearchInput />)

      expect(screen.getByRole("textbox")).toHaveValue("existing query")
    })
  })
})
