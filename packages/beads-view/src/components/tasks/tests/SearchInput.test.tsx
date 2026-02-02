import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { SearchInput, type SearchInputHandle } from ".././SearchInput"
import { beadsViewStore } from "@herbcaudill/beads-view"
import { createRef } from "react"

// Tests

describe("SearchInput", () => {
  beforeEach(() => {
    // Reset the store before each test
    beadsViewStore.getState().clearTaskSearchQuery()
    beadsViewStore.getState().clearSelectedTaskId()
    beadsViewStore.getState().setVisibleTaskIds([])
  })

  afterEach(() => {
    // Clean up
    beadsViewStore.getState().clearTaskSearchQuery()
    beadsViewStore.getState().clearSelectedTaskId()
    beadsViewStore.getState().setVisibleTaskIds([])
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

      expect(beadsViewStore.getState().taskSearchQuery).toBe("test query")
    })

    it("shows clear button when query is not empty", () => {
      // Set up query first
      beadsViewStore.getState().setTaskSearchQuery("test")
      render(<SearchInput />)

      expect(screen.getByRole("button", { name: "Clear search" })).toBeInTheDocument()
    })

    it("hides clear button when query is empty", () => {
      render(<SearchInput />)
      expect(screen.queryByRole("button", { name: "Clear search" })).not.toBeInTheDocument()
    })

    it("clears query when clear button is clicked", () => {
      beadsViewStore.getState().setTaskSearchQuery("test query")
      render(<SearchInput />)

      const clearButton = screen.getByRole("button", { name: "Clear search" })
      fireEvent.click(clearButton)

      expect(beadsViewStore.getState().taskSearchQuery).toBe("")
    })

    it("clears query on Escape key", () => {
      beadsViewStore.getState().setTaskSearchQuery("test query")
      render(<SearchInput />)

      const input = screen.getByRole("textbox")
      fireEvent.keyDown(input, { key: "Escape" })

      expect(beadsViewStore.getState().taskSearchQuery).toBe("")
    })
  })

  describe("keyboard navigation", () => {
    beforeEach(() => {
      // Set up some visible task IDs
      beadsViewStore.getState().setVisibleTaskIds(["task-1", "task-2", "task-3"])
    })

    it("selects first task on ArrowDown when no task is selected", () => {
      render(<SearchInput />)
      const input = screen.getByRole("textbox")

      fireEvent.keyDown(input, { key: "ArrowDown" })

      expect(beadsViewStore.getState().selectedTaskId).toBe("task-1")
    })

    it("selects next task on ArrowDown", () => {
      beadsViewStore.getState().setSelectedTaskId("task-1")
      render(<SearchInput />)
      const input = screen.getByRole("textbox")

      fireEvent.keyDown(input, { key: "ArrowDown" })

      expect(beadsViewStore.getState().selectedTaskId).toBe("task-2")
    })

    it("stays on last task when ArrowDown at end of list", () => {
      beadsViewStore.getState().setSelectedTaskId("task-3")
      render(<SearchInput />)
      const input = screen.getByRole("textbox")

      fireEvent.keyDown(input, { key: "ArrowDown" })

      expect(beadsViewStore.getState().selectedTaskId).toBe("task-3")
    })

    it("selects last task on ArrowUp when no task is selected", () => {
      render(<SearchInput />)
      const input = screen.getByRole("textbox")

      fireEvent.keyDown(input, { key: "ArrowUp" })

      expect(beadsViewStore.getState().selectedTaskId).toBe("task-3")
    })

    it("selects previous task on ArrowUp", () => {
      beadsViewStore.getState().setSelectedTaskId("task-2")
      render(<SearchInput />)
      const input = screen.getByRole("textbox")

      fireEvent.keyDown(input, { key: "ArrowUp" })

      expect(beadsViewStore.getState().selectedTaskId).toBe("task-1")
    })

    it("stays on first task when ArrowUp at beginning of list", () => {
      beadsViewStore.getState().setSelectedTaskId("task-1")
      render(<SearchInput />)
      const input = screen.getByRole("textbox")

      fireEvent.keyDown(input, { key: "ArrowUp" })

      expect(beadsViewStore.getState().selectedTaskId).toBe("task-1")
    })

    it("calls onOpenTask when Enter is pressed with selected task (keeps selection)", () => {
      const onOpenTask = vi.fn()
      beadsViewStore.getState().setSelectedTaskId("task-2")
      render(<SearchInput onOpenTask={onOpenTask} />)
      const input = screen.getByRole("textbox")

      fireEvent.keyDown(input, { key: "Enter" })

      expect(onOpenTask).toHaveBeenCalledWith("task-2")
      // Selection should persist so user can continue navigating after closing the opened task
      expect(beadsViewStore.getState().selectedTaskId).toBe("task-2")
    })

    it("does not call onOpenTask when Enter is pressed without selected task", () => {
      const onOpenTask = vi.fn()
      render(<SearchInput onOpenTask={onOpenTask} />)
      const input = screen.getByRole("textbox")

      fireEvent.keyDown(input, { key: "Enter" })

      expect(onOpenTask).not.toHaveBeenCalled()
    })

    it("clears selection on Escape", () => {
      beadsViewStore.getState().setSelectedTaskId("task-2")
      render(<SearchInput />)
      const input = screen.getByRole("textbox")

      fireEvent.keyDown(input, { key: "Escape" })

      expect(beadsViewStore.getState().selectedTaskId).toBe(null)
    })

    it("handles empty visible task list gracefully", () => {
      beadsViewStore.getState().setVisibleTaskIds([])
      render(<SearchInput />)
      const input = screen.getByRole("textbox")

      fireEvent.keyDown(input, { key: "ArrowDown" })

      expect(beadsViewStore.getState().selectedTaskId).toBe(null)
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
      beadsViewStore.getState().setTaskSearchQuery("test query")
      render(<SearchInput ref={ref} />)

      ref.current?.clear()
      expect(beadsViewStore.getState().taskSearchQuery).toBe("")
    })
  })

  describe("store integration", () => {
    it("displays current store value", () => {
      beadsViewStore.getState().setTaskSearchQuery("existing query")
      render(<SearchInput />)

      expect(screen.getByRole("textbox")).toHaveValue("existing query")
    })
  })

  describe("escape key behavior", () => {
    it("blurs input when Escape is pressed", () => {
      render(<SearchInput />)

      const input = screen.getByRole("textbox")
      input.focus()
      expect(document.activeElement).toBe(input)

      fireEvent.keyDown(input, { key: "Escape" })

      expect(document.activeElement).not.toBe(input)
    })
  })
})
