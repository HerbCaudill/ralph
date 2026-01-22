import React, { useState } from "react"
import { EnhancedTextInput } from "../EnhancedTextInput.js"

/**
 * Helper component that manages controlled state for EnhancedTextInput in tests.
 * Wraps the input with local state management to test change and submit handlers.
 */
export const ControlledInput = ({
  initialValue,
  onValueChange,
  onSubmit,
}: {
  /** Initial value for the input */
  initialValue: string
  /** Called when the input value changes */
  onValueChange?: (value: string) => void
  /** Called when the input is submitted */
  onSubmit?: (value: string) => void
}) => {
  const [value, setValue] = useState(initialValue)
  const handleChange = (newValue: string) => {
    setValue(newValue)
    onValueChange?.(newValue)
  }
  return <EnhancedTextInput value={value} onChange={handleChange} onSubmit={onSubmit} />
}
