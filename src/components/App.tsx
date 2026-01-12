import React from "react"
import { Box } from "ink"
import { Header } from "./Header.js"
import { IterationRunner } from "./IterationRunner.js"
import { ReplayLog } from "./ReplayLog.js"

export const App = ({ iterations, replayFile, claudeVersion, ralphVersion }: Props) => {
  if (replayFile) {
    return (
      <Box flexDirection="column" marginX={1}>
        <Header claudeVersion={claudeVersion} ralphVersion={ralphVersion} />
        <ReplayLog filePath={replayFile} />
      </Box>
    )
  }

  return (
    <Box flexDirection="column" marginX={1}>
      <Header claudeVersion={claudeVersion} ralphVersion={ralphVersion} />
      <IterationRunner totalIterations={iterations} />
    </Box>
  )
}

type Props = {
  iterations: number
  replayFile?: string
  claudeVersion: string
  ralphVersion: string
}
