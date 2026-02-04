import type { ReactNode } from "react"
import { TooltipProvider } from "@/components/ui/tooltip"

/**  Wrapper that includes all necessary providers for testing. */
export function TestProviders({
  /** Child components to wrap */
  children,
}: TestProvidersProps) {
  return <TooltipProvider>{children}</TooltipProvider>
}

interface TestProvidersProps {
  children: ReactNode
}
