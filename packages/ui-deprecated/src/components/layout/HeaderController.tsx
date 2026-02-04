import { useAppStore, selectAccentColor, selectInstanceCount } from "@/store"
import { Header } from "./Header"

/**
 * Controller component for the application header.
 *
 * Connects to the store to get accent color and instance count,
 * then passes the data to the presentational Header component.
 */
export function HeaderController(
  /** Props for HeaderController */
  { className }: HeaderControllerProps,
) {
  const accentColor = useAppStore(selectAccentColor)
  const instanceCount = useAppStore(selectInstanceCount)

  return <Header className={className} accentColor={accentColor} instanceCount={instanceCount} />
}

export type HeaderControllerProps = {
  /** Optional CSS class name to apply to the header */
  className?: string
}
