import React from "react"
import { Box, Text } from "ink"

/**
 * Renders a tool name and optional argument in a formatted display.
 */
export const ToolUse = ({ name, arg }: Props) => {
  return (
    <Box paddingLeft={2}>
      <Text color="blue">{name}</Text>
      {arg && (
        <>
          <Text> </Text>
          <Text dimColor>{arg}</Text>
        </>
      )}
    </Box>
  )
}

/**
 * Props for the ToolUse component.
 */
type Props = {
  /**
   * The tool name to display.
   */
  name: string
  /**
   * Optional argument to display.
   */
  arg?: string
}
