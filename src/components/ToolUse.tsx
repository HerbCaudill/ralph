import React from "react"
import { Box, Text } from "ink"

export const ToolUse = ({ name, arg }: Props) => {
  return (
    <Box marginTop={1} marginBottom={1} paddingLeft={2}>
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

type Props = {
  name: string
  arg?: string
}
