import React from "react"
import { Box, Text } from "ink"
import BigText from "ink-big-text"
import Gradient from "ink-gradient"

export const Header = ({ claudeVersion, ralphVersion }: Props) => {
  return (
    <Box
      flexDirection="column"
      marginBottom={1}
      borderStyle="single"
      padding={1}
      alignItems="center"
    >
      <Gradient colors={["#30A6E4", "#EBC635"]}>
        <BigText text="Ralph" font="block" />
      </Gradient>
      <Text dimColor>
        @herbcaudill/ralph v{ralphVersion} • Claude Code v{claudeVersion}
      </Text>
    </Box>
  )
}

type Props = {
  claudeVersion: string
  ralphVersion: string
}
