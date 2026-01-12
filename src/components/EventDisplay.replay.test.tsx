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

    console.log(`Parsed ${events.length} events`)
    const assistantEvents = events.filter(e => e.type === "assistant")
    console.log(`Found ${assistantEvents.length} assistant events`)

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
    console.log("Output length:", output.length)
    console.log("Output preview:", output.substring(0, 200))

    // Expected content based on the log:
    // 1. First text message: "I'll start by checking the types..."
    expect(output).toContain("I'll start by checking the types")

    // 2. TodoWrite should show (from first message)
    expect(output).toContain("TodoWrite")

    // 3. Bash command should show
    expect(output).toContain("$ pnpm typecheck")

    // 4. Second text message: "Good! Types check successfully..."
    expect(output).toContain("Good! Types check successfully")

    // Should NOT duplicate message IDs
    // The same message ID appears multiple times but should only show once
    const textOccurrences = output.match(/I'll start by checking the types/g)?.length || 0
    expect(textOccurrences).toBe(1)
  })
})
