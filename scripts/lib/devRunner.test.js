import { afterEach, expect, it, vi } from "vitest"
import { createServer } from "node:net"
import { findAvailablePort } from "./devRunner.js"

afterEach(() => vi.unstubAllEnvs())

it("keeps backend allocation away from the router's reserved frontend port", async () => {
  const server = createServer()
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve))
  const port = server.address().port
  await new Promise(resolve => server.close(resolve))
  vi.stubEnv("PORTLESS_URL", "https://ralph.localhost")
  vi.stubEnv("PORT", String(port))
  expect(await findAvailablePort(port)).not.toBe(port)
})
