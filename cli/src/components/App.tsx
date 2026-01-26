import React from "react"
import { SessionRunner } from "./SessionRunner.js"
import { ReplayLog } from "./ReplayLog.js"
import { JsonOutput } from "./JsonOutput.js"

/**
 * Root application component that routes to the appropriate mode based on props.
 * Supports replay mode, JSON output mode, and normal session mode.
 */
export const App = ({
  sessions,
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
    return <JsonOutput totalSessions={sessions} agent={agent} />
  }

  return (
    <SessionRunner
      totalSessions={sessions}
      claudeVersion={claudeVersion}
      ralphVersion={ralphVersion}
      watch={watch}
      agent={agent}
    />
  )
}

type Props = {
  sessions: number
  replayFile?: string
  claudeVersion: string
  ralphVersion: string
  watch?: boolean
  json?: boolean
  agent: string
}
