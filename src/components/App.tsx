import React from "react"
import { Box } from "ink"
import { IterationRunner } from "./IterationRunner.js"
import { ReplayLog } from "./ReplayLog.js"

export const App = ({ iterations, replayFile, claudeVersion, ralphVersion }: Props) => {
  if (replayFile) {
    return (
      <Box flexDirection="column" marginX={1}>
        <ReplayLog
          filePath={replayFile}
          claudeVersion={claudeVersion}
          ralphVersion={ralphVersion}
        />
      </Box>
    )
  }

  return (
    <Box flexDirection="column" marginX={1}>
      <IterationRunner
        totalIterations={iterations}
        claudeVersion={claudeVersion}
        ralphVersion={ralphVersion}
      />
    </Box>
  )
}

type Props = {
  iterations: number
  replayFile?: string
  claudeVersion: string
  ralphVersion: string
}
