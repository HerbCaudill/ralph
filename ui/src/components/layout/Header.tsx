import { useAppStore, selectAccentColor, selectInstanceCount } from "@/store"
import { HeaderView } from "./HeaderView"

/**
 * Controller component for the application header.
 *
 * Connects to the store to get accent color and instance count,
 * then passes the data to the presentational HeaderView component.
 */
export function Header({ className }: HeaderProps) {
  const accentColor = useAppStore(selectAccentColor)
  const instanceCount = useAppStore(selectInstanceCount)

  return (
    <HeaderView className={className} accentColor={accentColor} instanceCount={instanceCount} />
  )
}

export type HeaderProps = {
  className?: string
}

// Re-export the view for direct usage in stories
export { HeaderView } from "./HeaderView"
export type { HeaderViewProps } from "./HeaderView"
