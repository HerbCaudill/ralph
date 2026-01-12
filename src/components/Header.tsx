import React from "react"
import { Box, Text } from "ink"
import BigText from "ink-big-text"

export const Header = ({ claudeVersion, ralphVersion }: Props) => {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <BigText text="Ralph" font="block" colors={["cyan", "magenta"]} />
      <Text dimColor>
        @herbcaudill/ralph v{ralphVersion} • Claude Code v{claudeVersion}
      </Text>
      <Box borderStyle="single" borderTop={false} borderLeft={false} borderRight={false} />
    </Box>
  )
}

type Props = {
  claudeVersion: string
  ralphVersion: string
}
