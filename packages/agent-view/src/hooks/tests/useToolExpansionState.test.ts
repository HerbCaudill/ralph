import { describe, it, expect } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useToolExpansionState } from "../useToolExpansionState"

describe("useToolExpansionState", () => {
  it("initializes with empty state", () => {
    const { result } = renderHook(() => useToolExpansionState())

    expect(result.current.toolExpansionState.size).toBe(0)
  })

  it("sets and retrieves tool expansion state", () => {
    const { result } = renderHook(() => useToolExpansionState())

    act(() => {
      result.current.setToolExpansionState("tool-1", true)
      result.current.setToolExpansionState("tool-2", false)
    })

    expect(result.current.toolExpansionState.get("tool-1")).toBe(true)
    expect(result.current.toolExpansionState.get("tool-2")).toBe(false)
  })

  it("overwrites existing state", () => {
    const { result } = renderHook(() => useToolExpansionState())

    act(() => {
      result.current.setToolExpansionState("tool-1", true)
    })
    expect(result.current.toolExpansionState.get("tool-1")).toBe(true)

    act(() => {
      result.current.setToolExpansionState("tool-1", false)
    })
    expect(result.current.toolExpansionState.get("tool-1")).toBe(false)
  })

  it("clears all state", () => {
    const { result } = renderHook(() => useToolExpansionState())

    act(() => {
      result.current.setToolExpansionState("tool-1", true)
      result.current.setToolExpansionState("tool-2", false)
    })
    expect(result.current.toolExpansionState.size).toBe(2)

    act(() => {
      result.current.clearToolExpansionState()
    })
    expect(result.current.toolExpansionState.size).toBe(0)
  })

  it("maintains stable references across renders", () => {
    const { result, rerender } = renderHook(() => useToolExpansionState())

    const initialSetter = result.current.setToolExpansionState
    const initialClear = result.current.clearToolExpansionState

    rerender()

    expect(result.current.setToolExpansionState).toBe(initialSetter)
    expect(result.current.clearToolExpansionState).toBe(initialClear)
  })

  it("persists state across re-renders", () => {
    const { result, rerender } = renderHook(() => useToolExpansionState())

    act(() => {
      result.current.setToolExpansionState("tool-1", false)
    })

    rerender()

    expect(result.current.toolExpansionState.get("tool-1")).toBe(false)
  })
})
