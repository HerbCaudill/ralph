/**
 * Configuration for the beads-view API client.
 */
export interface ApiClientConfig {
  /** Base URL for API requests (e.g., "http://localhost:3000"). Defaults to "" (relative URLs). */
  baseUrl?: string
  /** Optional custom fetch function (for testing or custom transports). */
  fetchFn?: typeof fetch
}

/** Singleton API client configuration. */
let clientConfig: ApiClientConfig = {}

/**
 * Configure the API client with a base URL and optional custom fetch.
 *
 * Call this at app startup before any API requests are made:
 * ```ts
 * configureApiClient({ baseUrl: "http://localhost:3000" })
 * ```
 */
export function configureApiClient(config: ApiClientConfig): void {
  clientConfig = { ...config }
}

/**
 * Get the current API client configuration.
 */
export function getApiClientConfig(): ApiClientConfig {
  return clientConfig
}

/**
 * Build a full API URL by prepending the configured base URL.
 */
export function buildApiUrl(path: string): string {
  const base = clientConfig.baseUrl ?? ""
  return `${base}${path}`
}

/**
 * Perform a fetch request using the configured API client settings.
 */
export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const url = buildApiUrl(path)
  const fetchFn = clientConfig.fetchFn ?? fetch
  return fetchFn(url, init)
}
