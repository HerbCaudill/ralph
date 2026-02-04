import { render, type RenderOptions } from "@testing-library/react"
import type { ReactElement } from "react"
import { TestProviders } from "@/components/TestProviders"

/**  Custom render function that wraps components with necessary providers. */
function customRender(
  /** UI element to render */
  ui: ReactElement,
  /** Render options */
  options?: Omit<RenderOptions, "wrapper">,
) {
  return render(ui, { wrapper: TestProviders, ...options })
}

// Re-export everything from testing-library
export * from "@testing-library/react"
// Override render with our custom version
export { customRender as render }
