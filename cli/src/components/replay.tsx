import React from "react"
import { readFileSync } from "fs"
import { join } from "path"
import { render } from "ink-testing-library"
import { vi, expect } from "vitest"
import { EventDisplay } from "./EventDisplay.js"

/**  Helper function to replay an event log file and return the rendered output. */
export async function replay(
  /** The name of the log file to replay */
  logFile: string,
): Promise<string> {
  // Read the event log
  const logPath = join(process.cwd(), "test/event-logs", logFile)
  const logContent = readFileSync(logPath, "utf-8")

  // Parse JSON events (multi-line JSON objects separated by blank lines)
  const events: Array<Record<string, unknown>> = []
  const jsonObjects = logContent.split("\n\n")
  for (const jsonStr of jsonObjects) {
    if (!jsonStr.trim()) continue
    try {
      const event = JSON.parse(jsonStr)
      events.push(event)
    } catch {
      // Skip invalid JSON
    }
  }

  const previousCwd = process.env.RALPH_CWD
  const initEvent = events.find(
    event => event.type === "system" && event.subtype === "init" && typeof event.cwd === "string",
  ) as { cwd?: string } | undefined
  if (initEvent?.cwd) {
    process.env.RALPH_CWD = initEvent.cwd
  }

  // Render with all events
  const { lastFrame } = render(
    <EventDisplay events={events} iteration={1} completedIterations={[]} />,
  )

  // Wait for rendering
  await vi.waitFor(
    () => {
      const output = lastFrame() ?? ""
      expect(output.length).toBeGreaterThan(0)
    },
    { timeout: 1000 },
  )

  const output = lastFrame() ?? ""

  if (previousCwd === undefined) {
    delete process.env.RALPH_CWD
  } else {
    process.env.RALPH_CWD = previousCwd
  }

  return output
}
