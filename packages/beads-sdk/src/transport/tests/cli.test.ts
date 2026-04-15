import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { chmodSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { CliTransport } from "../cli.js"

/** Create a temporary executable `bd` fixture that records invocations. */
function writeBdFixture(
  /** Directory where the executable should be written */
  binDir: string,
  /** JavaScript source to run inside the fixture */
  source: string,
): string {
  const bdPath = join(binDir, "bd")
  writeFileSync(bdPath, `#!/usr/bin/env node\n${source}`)
  chmodSync(bdPath, 0o755)
  return bdPath
}

describe("CliTransport", () => {
  let tempDir: string
  let binDir: string
  let logPath: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "beads-cli-test-"))
    binDir = join(tempDir, "bin")
    mkdirSync(binDir)
    logPath = join(tempDir, "args.jsonl")
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  it("runs bd from the configured workspace and parses JSON with leading text", async () => {
    const bdPath = writeBdFixture(
      binDir,
      `
const { appendFileSync } = require("node:fs");
appendFileSync(${JSON.stringify(logPath)}, JSON.stringify({ cwd: process.cwd(), args: process.argv.slice(2) }) + "\\n");
console.log("setup message");
console.log(JSON.stringify({ version: "1.0.0" }));
`,
    )

    const transport = new CliTransport(tempDir, { bdPath })
    const result = (await transport.send("ping", {})) as { message: string; version: string }

    expect(result).toEqual({ message: "pong", version: "1.0.0" })
    const calls = readFileSync(logPath, "utf8")
      .trim()
      .split("\n")
      .map(line => JSON.parse(line) as { cwd: string; args: string[] })
    expect(calls).toEqual([{ cwd: realpathSync(tempDir), args: ["version", "--json"] }])
  })

  it("maps list filters to v1 CLI flags", async () => {
    const bdPath = writeBdFixture(
      binDir,
      `
const { appendFileSync } = require("node:fs");
appendFileSync(${JSON.stringify(logPath)}, JSON.stringify(process.argv.slice(2)) + "\\n");
console.log(JSON.stringify([]));
`,
    )
    const transport = new CliTransport(tempDir, { bdPath })

    await transport.send("list", {
      status: "open",
      priority: 1,
      issue_type: "story",
      assignee: "herb",
      labels: ["sdk", "v1"],
      labels_any: ["urgent", "api"],
      query: "transport",
      unassigned: true,
      limit: 25,
    })

    const args = JSON.parse(readFileSync(logPath, "utf8").trim()) as string[]
    expect(args).toEqual([
      "list",
      "--json",
      "--all",
      "--status",
      "open",
      "--priority",
      "1",
      "--type",
      "story",
      "--assignee",
      "herb",
      "--label",
      "sdk,v1",
      "--label-any",
      "urgent,api",
      "--title",
      "transport",
      "--no-assignee",
      "--limit",
      "25",
    ])
  })

  it("maps create input to v1 CLI flags", async () => {
    const bdPath = writeBdFixture(
      binDir,
      `
const { appendFileSync } = require("node:fs");
appendFileSync(${JSON.stringify(logPath)}, JSON.stringify(process.argv.slice(2)) + "\\n");
console.log(JSON.stringify({ id: "bd-1", title: "Create me" }));
`,
    )
    const transport = new CliTransport(tempDir, { bdPath })

    const issue = (await transport.send("create", {
      title: "Create me",
      description: "Body",
      design: "Design",
      acceptance_criteria: "Done",
      priority: 0,
      issue_type: "spike",
      assignee: "herb",
      labels: ["sdk", "v1"],
      dependencies: ["bd-0"],
      id: "bd-1",
    })) as { id: string }

    expect(issue.id).toBe("bd-1")
    const args = JSON.parse(readFileSync(logPath, "utf8").trim()) as string[]
    expect(args).toEqual([
      "create",
      "Create me",
      "--json",
      "--description",
      "Body",
      "--design",
      "Design",
      "--acceptance",
      "Done",
      "--priority",
      "0",
      "--type",
      "spike",
      "--assignee",
      "herb",
      "--labels",
      "sdk,v1",
      "--deps",
      "bd-0",
      "--id",
      "bd-1",
    ])
  })

  it("normalizes label_list_all objects to label strings", async () => {
    const bdPath = writeBdFixture(
      binDir,
      `
console.log(JSON.stringify([{ label: "sdk", count: 2 }, { label: "v1", count: 1 }]));
`,
    )
    const transport = new CliTransport(tempDir, { bdPath })

    await expect(transport.send("label_list_all", {})).resolves.toEqual(["sdk", "v1"])
  })

  it("rejects unsupported daemon-only mutation operations", async () => {
    const bdPath = writeBdFixture(binDir, `console.log(JSON.stringify({ version: "1.0.0" }));`)
    const transport = new CliTransport(tempDir, { bdPath })

    await expect(transport.send("get_mutations", { since: 0 })).rejects.toThrow(
      "not supported by the v1 CLI transport",
    )
  })
})
