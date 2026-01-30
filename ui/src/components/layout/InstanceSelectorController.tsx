import { useAppStore, selectInstances, selectActiveInstanceId } from "@/store"
import { InstanceSelector } from "./InstanceSelector"

/**
 * Controller component for InstanceSelector.
 *
 * Connects to the store to get instances and active instance,
 * then passes the data to the InstanceSelector presentational component.
 */
export function InstanceSelectorController(
  /** Props for InstanceSelectorController */
  { className, textColor }: InstanceSelectorControllerProps,
) {
  const instances = useAppStore(selectInstances)
  const activeInstanceId = useAppStore(selectActiveInstanceId)
  const setActiveInstanceId = useAppStore(state => state.setActiveInstanceId)

  return (
    <InstanceSelector
      className={className}
      textColor={textColor}
      instances={instances}
      activeInstanceId={activeInstanceId}
      onSelectInstance={setActiveInstanceId}
    />
  )
}

export type InstanceSelectorControllerProps = {
  /** Additional CSS classes */
  className?: string
  /** Text color for header variant (passed from Header) */
  textColor?: string
}
