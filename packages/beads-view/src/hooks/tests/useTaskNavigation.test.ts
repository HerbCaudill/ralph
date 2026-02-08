import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useTaskNavigation } from "../useTaskNavigation"
import { beadsViewStore } from "../../store"

describe("useTaskNavigation", () => {
  const mockOpenTask = vi.fn()

  beforeEach(() => {
    mockOpenTask.mockReset()
    beadsViewStore.setState({
      selectedTaskId: null,
      visibleTaskIds: [],
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("navigatePrevious", () => {
    it("does nothing when there are no visible tasks", () => {
      beadsViewStore.setState({ visibleTaskIds: [], selectedTaskId: null })

      const { result } = renderHook(() => useTaskNavigation({ onOpenTask: mockOpenTask }))

      act(() => {
        result.current.navigatePrevious()
      })

      expect(beadsViewStore.getState().selectedTaskId).toBeNull()
      expect(mockOpenTask).not.toHaveBeenCalled()
    })

    it("selects the last task when no task is currently selected", () => {
      beadsViewStore.setState({
        visibleTaskIds: ["task-1", "task-2", "task-3"],
        selectedTaskId: null,
      })

      const { result } = renderHook(() => useTaskNavigation({ onOpenTask: mockOpenTask }))

      act(() => {
        result.current.navigatePrevious()
      })

      expect(beadsViewStore.getState().selectedTaskId).toBe("task-3")
      expect(mockOpenTask).toHaveBeenCalledWith("task-3")
    })

    it("selects the previous task when a task is selected", () => {
      beadsViewStore.setState({
        visibleTaskIds: ["task-1", "task-2", "task-3"],
        selectedTaskId: "task-2",
      })

      const { result } = renderHook(() => useTaskNavigation({ onOpenTask: mockOpenTask }))

      act(() => {
        result.current.navigatePrevious()
      })

      expect(beadsViewStore.getState().selectedTaskId).toBe("task-1")
      expect(mockOpenTask).toHaveBeenCalledWith("task-1")
    })

    it("stays on the first task when already at the beginning", () => {
      beadsViewStore.setState({
        visibleTaskIds: ["task-1", "task-2", "task-3"],
        selectedTaskId: "task-1",
      })

      const { result } = renderHook(() => useTaskNavigation({ onOpenTask: mockOpenTask }))

      act(() => {
        result.current.navigatePrevious()
      })

      expect(beadsViewStore.getState().selectedTaskId).toBe("task-1")
      expect(mockOpenTask).toHaveBeenCalledWith("task-1")
    })

    it("auto-opens the task when navigating", () => {
      beadsViewStore.setState({
        visibleTaskIds: ["task-1", "task-2"],
        selectedTaskId: "task-2",
      })

      const { result } = renderHook(() => useTaskNavigation({ onOpenTask: mockOpenTask }))

      act(() => {
        result.current.navigatePrevious()
      })

      expect(mockOpenTask).toHaveBeenCalledWith("task-1")
      expect(mockOpenTask).toHaveBeenCalledTimes(1)
    })
  })

  describe("navigateNext", () => {
    it("does nothing when there are no visible tasks", () => {
      beadsViewStore.setState({ visibleTaskIds: [], selectedTaskId: null })

      const { result } = renderHook(() => useTaskNavigation({ onOpenTask: mockOpenTask }))

      act(() => {
        result.current.navigateNext()
      })

      expect(beadsViewStore.getState().selectedTaskId).toBeNull()
      expect(mockOpenTask).not.toHaveBeenCalled()
    })

    it("selects the first task when no task is currently selected", () => {
      beadsViewStore.setState({
        visibleTaskIds: ["task-1", "task-2", "task-3"],
        selectedTaskId: null,
      })

      const { result } = renderHook(() => useTaskNavigation({ onOpenTask: mockOpenTask }))

      act(() => {
        result.current.navigateNext()
      })

      expect(beadsViewStore.getState().selectedTaskId).toBe("task-1")
      expect(mockOpenTask).toHaveBeenCalledWith("task-1")
    })

    it("selects the next task when a task is selected", () => {
      beadsViewStore.setState({
        visibleTaskIds: ["task-1", "task-2", "task-3"],
        selectedTaskId: "task-1",
      })

      const { result } = renderHook(() => useTaskNavigation({ onOpenTask: mockOpenTask }))

      act(() => {
        result.current.navigateNext()
      })

      expect(beadsViewStore.getState().selectedTaskId).toBe("task-2")
      expect(mockOpenTask).toHaveBeenCalledWith("task-2")
    })

    it("stays on the last task when already at the end", () => {
      beadsViewStore.setState({
        visibleTaskIds: ["task-1", "task-2", "task-3"],
        selectedTaskId: "task-3",
      })

      const { result } = renderHook(() => useTaskNavigation({ onOpenTask: mockOpenTask }))

      act(() => {
        result.current.navigateNext()
      })

      expect(beadsViewStore.getState().selectedTaskId).toBe("task-3")
      expect(mockOpenTask).toHaveBeenCalledWith("task-3")
    })

    it("auto-opens the task when navigating", () => {
      beadsViewStore.setState({
        visibleTaskIds: ["task-1", "task-2"],
        selectedTaskId: "task-1",
      })

      const { result } = renderHook(() => useTaskNavigation({ onOpenTask: mockOpenTask }))

      act(() => {
        result.current.navigateNext()
      })

      expect(mockOpenTask).toHaveBeenCalledWith("task-2")
      expect(mockOpenTask).toHaveBeenCalledTimes(1)
    })
  })

  describe("openSelected", () => {
    it("opens the currently selected task", () => {
      beadsViewStore.setState({
        visibleTaskIds: ["task-1", "task-2"],
        selectedTaskId: "task-1",
      })

      const { result } = renderHook(() => useTaskNavigation({ onOpenTask: mockOpenTask }))

      act(() => {
        result.current.openSelected()
      })

      expect(mockOpenTask).toHaveBeenCalledWith("task-1")
    })

    it("does nothing when no task is selected", () => {
      beadsViewStore.setState({
        visibleTaskIds: ["task-1", "task-2"],
        selectedTaskId: null,
      })

      const { result } = renderHook(() => useTaskNavigation({ onOpenTask: mockOpenTask }))

      act(() => {
        result.current.openSelected()
      })

      expect(mockOpenTask).not.toHaveBeenCalled()
    })
  })

  describe("without onOpenTask callback", () => {
    it("navigates without opening when no callback provided", () => {
      beadsViewStore.setState({
        visibleTaskIds: ["task-1", "task-2"],
        selectedTaskId: "task-1",
      })

      const { result } = renderHook(() => useTaskNavigation())

      act(() => {
        result.current.navigateNext()
      })

      // Should still update selected task in store
      expect(beadsViewStore.getState().selectedTaskId).toBe("task-2")
    })
  })
})
