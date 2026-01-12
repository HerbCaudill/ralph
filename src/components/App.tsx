import React from "react"
import { IterationRunner } from "./IterationRunner.js"
import { ReplayLog } from "./ReplayLog.js"

export const App = ({ iterations, replayFile }: Props) => {
  if (replayFile) {
    return <ReplayLog filePath={replayFile} />
  }

  return <IterationRunner totalIterations={iterations} />
}

type Props = {
  iterations: number
  replayFile?: string
}
