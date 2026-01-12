import React from "react"
import { Box, Text } from "ink"
import BigText from "ink-big-text"

export const Header = ({ version }: Props) => {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <BigText text="Ralph" font="block" colors={["cyan", "magenta"]} />
      <Text dimColor>Claude Code v{version}</Text>
      <Box borderStyle="single" borderTop={false} borderLeft={false} borderRight={false} />
    </Box>
  )
}

type Props = {
  version: string
}
