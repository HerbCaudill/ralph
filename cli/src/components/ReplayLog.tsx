import React, { useState, useEffect } from "react"
import { Box, Text, useApp } from "ink"
import { readFileSync } from "fs"
import { EventDisplay } from "./EventDisplay.js"
import { FullScreenLayout } from "./FullScreenLayout.js"
import { useContentHeight } from "./useContentHeight.js"

export const ReplayLog = ({
  /** The path to the replay log file */
  filePath,
}: Props) => {
  const { exit } = useApp()
  const [events, setEvents] = useState<Array<Record<string, unknown>>>([])
  const [error, setError] = useState<string>()

  /**
   * Load and parse the replay log file on mount.
   * Parses pretty-printed JSON objects separated by blank lines.
   */
  useEffect(() => {
    try {
      const content = readFileSync(filePath, "utf-8")
      // Log file contains pretty-printed JSON objects separated by blank lines
      const eventStrings = content.split(/\n\n+/).filter(s => s.trim())

      const parsedEvents: Array<Record<string, unknown>> = []
      for (const eventStr of eventStrings) {
        try {
          const event = JSON.parse(eventStr)
          parsedEvents.push(event)
        } catch {
          // Skip malformed entries
        }
      }

      setEvents(parsedEvents)
      setTimeout(() => {
        exit()
        process.exit(0)
      }, 100)
    } catch (err) {
      setError(`Failed to read replay file: ${err instanceof Error ? err.message : String(err)}`)
      setTimeout(() => {
        exit()
        process.exit(1)
      }, 100)
    }
  }, [filePath, exit])

  if (error) {
    return (
      <Box flexDirection="column">
        <Text color="red">{error}</Text>
      </Box>
    )
  }

  const footer = <Text dimColor>Replaying: {filePath}</Text>
  const contentHeight = useContentHeight(true)

  return (
    <FullScreenLayout title="Ralph" footer={footer}>
      <EventDisplay events={events} session={1} completedSessions={[]} height={contentHeight} />
    </FullScreenLayout>
  )
}

type Props = {
  filePath: string
}
