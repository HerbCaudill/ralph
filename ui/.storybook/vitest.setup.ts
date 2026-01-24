import { setProjectAnnotations } from "@storybook/react"
import * as previewAnnotations from "./preview"

/**
 * Set up Storybook annotations for Vitest browser tests.
 * This ensures decorators, parameters, and other preview config are applied.
 */
setProjectAnnotations([previewAnnotations])

/**
 * Mock fetch for API endpoints that don't exist during Storybook tests.
 * Returns empty/default responses to prevent console errors.
 */
const originalFetch = globalThis.fetch
globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url =
    typeof input === "string" ? input
    : input instanceof URL ? input.href
    : input.url

  // Mock API endpoints with empty responses
  if (url.includes("/api/")) {
    // Return appropriate empty responses based on endpoint
    if (url.includes("/labels")) {
      return new Response(JSON.stringify([]), { status: 200 })
    }
    if (url.includes("/comments")) {
      return new Response(JSON.stringify([]), { status: 200 })
    }
    if (url.includes("/eventlogs")) {
      return new Response(JSON.stringify([]), { status: 200 })
    }
    if (url.includes("/tasks/")) {
      // Task details endpoint - return a minimal task object
      return new Response(JSON.stringify({ blockedBy: [], blocks: [] }), { status: 200 })
    }
    // Default empty response for other API endpoints
    return new Response(JSON.stringify({}), { status: 200 })
  }

  return originalFetch(input, init)
}
