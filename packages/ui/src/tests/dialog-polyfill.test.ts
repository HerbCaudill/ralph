import { describe, expect, it } from "vitest"

describe(
  "dialog polyfill",
  /** Verify dialog methods are defined for the test environment. */ () => {
    it(
      "defines showModal on HTMLDialogElement",
      /** Ensure showModal is available for components using dialogs. */ () => {
        expect(HTMLDialogElement).toBeDefined()
        expect(typeof HTMLDialogElement.prototype.showModal).toBe("function")
      },
    )
  },
)
