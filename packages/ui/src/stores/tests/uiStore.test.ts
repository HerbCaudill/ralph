import { describe, expect, it } from "vitest"
import { useUiStore } from "../uiStore"

/** Verify default UI store preferences. */
describe("useUiStore", () => {
  /** Default tool output visibility is hidden. */
  it("defaults showToolOutput to false", () => {
    expect(useUiStore.getInitialState().showToolOutput).toBe(false)
  })
})
