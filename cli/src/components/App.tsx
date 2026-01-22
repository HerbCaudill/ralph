import React from "react"
import { IterationRunner } from "./IterationRunner.js"
import { ReplayLog } from "./ReplayLog.js"
import { JsonOutput } from "./JsonOutput.js"

/**
 * Root application component that routes to the appropriate mode based on props.
 * Supports replay mode, JSON output mode, and normal iteration mode.
 */
export const App = ({
  iterations,
  replayFile,
  claudeVersion,
  ralphVersion,
  watch,
  json,
  agent,
}: Props) => {
  if (replayFile) {
    return <ReplayLog filePath={replayFile} />
  }

  if (json) {
    return <JsonOutput totalIterations={iterations} agent={agent} />
  }

  return (
    <IterationRunner
      totalIterations={iterations}
      claudeVersion={claudeVersion}
      ralphVersion={ralphVersion}
      watch={watch}
      agent={agent}
    />
  )
}

type Props = {
  iterations: number
  replayFile?: string
  claudeVersion: string
  ralphVersion: string
  watch?: boolean
  json?: boolean
  agent: string
}
