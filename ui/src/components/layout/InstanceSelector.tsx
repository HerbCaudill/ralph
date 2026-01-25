import { useAppStore, selectInstances, selectActiveInstanceId } from "@/store"
import { InstanceSelectorView } from "./InstanceSelectorView"

/**
 * Controller component for InstanceSelector.
 *
 * Connects to the store to get instances and active instance,
 * then passes the data to the InstanceSelectorView presentational component.
 */
export function InstanceSelector({ className, textColor }: InstanceSelectorProps) {
  const instances = useAppStore(selectInstances)
  const activeInstanceId = useAppStore(selectActiveInstanceId)
  const setActiveInstanceId = useAppStore(state => state.setActiveInstanceId)

  return (
    <InstanceSelectorView
      className={className}
      textColor={textColor}
      instances={instances}
      activeInstanceId={activeInstanceId}
      onSelectInstance={setActiveInstanceId}
    />
  )
}

export type InstanceSelectorProps = {
  /** Additional CSS classes */
  className?: string
  /** Text color for header variant (passed from Header) */
  textColor?: string
}

// Re-export the view for direct usage in stories
export { InstanceSelectorView } from "./InstanceSelectorView"
export type { InstanceSelectorViewProps } from "./InstanceSelectorView"
