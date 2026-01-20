import { render, type RenderOptions } from "@testing-library/react"
import { TooltipProvider } from "@/components/ui/tooltip"
import type { ReactElement, ReactNode } from "react"

// Wrapper that includes all necessary providers for testing
function AllProviders({ children }: { children: ReactNode }) {
  return <TooltipProvider>{children}</TooltipProvider>
}

// Custom render function that wraps components with necessary providers
function customRender(ui: ReactElement, options?: Omit<RenderOptions, "wrapper">) {
  return render(ui, { wrapper: AllProviders, ...options })
}

// Re-export everything from testing-library
export * from "@testing-library/react"
// Override render with our custom version
export { customRender as render }
