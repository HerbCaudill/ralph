import React from "react"
import { IterationRunner } from "./IterationRunner.js"
import { ReplayLog } from "./ReplayLog.js"

export const App = ({ iterations, replayFile, claudeVersion, ralphVersion }: Props) => {
  if (replayFile) {
    return <ReplayLog filePath={replayFile} />
  }

  return (
    <IterationRunner
      totalIterations={iterations}
      claudeVersion={claudeVersion}
      ralphVersion={ralphVersion}
    />
  )
}

type Props = {
  iterations: number
  replayFile?: string
  claudeVersion: string
  ralphVersion: string
}
