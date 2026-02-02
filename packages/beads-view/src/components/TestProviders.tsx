import type { ReactNode } from "react"

/**
 * Wrapper that includes all necessary providers for testing.
 * Currently minimal since beads-view doesn't have tooltips or other providers yet.
 */
export function TestProviders({
  /** Child components to wrap */
  children,
}: TestProvidersProps) {
  return <>{children}</>
}

interface TestProvidersProps {
  children: ReactNode
}
