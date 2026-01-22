import React from "react"
import { Box, Text } from "ink"
import BigText from "ink-big-text"
import Gradient from "ink-gradient"

/**
 * Display the Ralph header with version information and branding.
 */
export const Header = ({
  /** The Claude CLI version */
  claudeVersion,
  /** The Ralph version */
  ralphVersion,
  /** Optional box width */
  width,
}: Props) => {
  return (
    <Box
      flexDirection="column"
      marginBottom={1}
      borderStyle="single"
      alignItems="center"
      width={width}
      paddingX={2}
    >
      <Gradient colors={["#30A6E4", "#EBC635"]}>
        <BigText text="Ralph" font="tiny" />
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
  width?: number
}
