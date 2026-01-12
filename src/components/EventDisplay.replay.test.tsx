import React from "react"
import { render } from "ink-testing-library"
import { describe, it, expect, vi } from "vitest"
import { readFileSync } from "fs"
import { join } from "path"
import { EventDisplay } from "./EventDisplay.js"

describe("EventDisplay replay tests", () => {
  it("replays event log and matches expected output", async () => {
    // Read the event log
    const logPath = join(process.cwd(), "test/event-logs/1.txt")
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

    const assistantEvents = events.filter(e => e.type === "assistant")

    // Render with all events
    const { lastFrame } = render(<EventDisplay events={events} />)

    // Wait for rendering with vi.waitFor
    await vi.waitFor(
      () => {
        const output = lastFrame() ?? ""
        expect(output.length).toBeGreaterThan(0)
      },
      { timeout: 1000 },
    )

    const output = lastFrame() ?? ""

    expect(output).toMatchInlineSnapshot(`
      "I'll start by checking the types, unit tests, and end-to-end tests as instructed.

        TodoWrite
                      [~] Run typecheck to verify types
                      [ ] Run unit tests via pnpm test
                      [ ] Run end-to-end tests via pnpm test:pw

        $ pnpm typecheck

      Good! Types check successfully. Now let me run the unit tests.

        TodoWrite
                      [x] Run typecheck to verify types
                      [~] Run unit tests via pnpm test
                      [ ] Run end-to-end tests via pnpm test:pw

        $ pnpm test

      Perfect! Unit tests pass. Now let me run the end-to-end tests.

        TodoWrite
                      [x] Run typecheck to verify types
                      [x] Run unit tests via pnpm test
                      [~] Run end-to-end tests via pnpm test:pw

        $ pnpm test:pw"
    `)
  })
})
