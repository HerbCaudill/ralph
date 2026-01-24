/**
 * Test utilities for Storybook interaction tests.
 * Provides helpers for mocking APIs and managing test state.
 */

import { TASK_INPUT_DRAFT_STORAGE_KEY } from "../src/constants"

/**
 * Creates a mock fetch function that returns the specified response.
 * Restores the original fetch when the returned cleanup function is called.
 */
export function mockFetch(response: MockFetchResponse): () => void {
  const originalFetch = window.fetch

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString()
    const method = init?.method ?? "GET"

    // Check if this request matches our mock
    if (response.url && !url.includes(response.url)) {
      return originalFetch(input, init)
    }
    if (response.method && method !== response.method) {
      return originalFetch(input, init)
    }

    // Return mocked response
    return new Response(JSON.stringify(response.body), {
      status: response.status ?? 200,
      headers: { "Content-Type": "application/json" },
    })
  }

  return () => {
    window.fetch = originalFetch
  }
}

/**
 * Clears localStorage keys used by the QuickTaskInput component.
 */
export function clearTaskInputStorage(): void {
  localStorage.removeItem(TASK_INPUT_DRAFT_STORAGE_KEY)
}

/**
 * Clears all test-related localStorage keys.
 */
export function clearTestStorage(): void {
  clearTaskInputStorage()
}

/**
 * Waits for a specified number of milliseconds.
 * Useful for waiting for animations or async operations in play functions.
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

type MockFetchResponse = {
  /** URL pattern to match (partial match) */
  url?: string
  /** HTTP method to match */
  method?: string
  /** Response status code */
  status?: number
  /** Response body (will be JSON stringified) */
  body: unknown
}
