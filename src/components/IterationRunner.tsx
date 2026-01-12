import React, { useState, useEffect, useRef } from "react"
import { Box, Text, useApp } from "ink"
import SelectInput from "ink-select-input"
import { spawn, execSync } from "child_process"
import { appendFileSync, mkdirSync, existsSync } from "fs"
import { join } from "path"
import { EventDisplay } from "./EventDisplay.js"
import { type WorktreeInfo } from "../lib/types.js"
import { getGitRoot } from "../lib/getGitRoot.js"
import { stashChanges } from "../lib/stashChanges.js"
import { popStash } from "../lib/popStash.js"
import { createWorktree } from "../lib/createWorktree.js"
import { copyRalphFilesToWorktree } from "../lib/copyRalphFilesToWorktree.js"
import { copyRalphFilesFromWorktree } from "../lib/copyRalphFilesFromWorktree.js"
import { mergeWorktreeToMain } from "../lib/mergeWorktreeToMain.js"
import { cleanupWorktree } from "../lib/cleanupWorktree.js"
import { installDependencies } from "../lib/installDependencies.js"

const repoRoot = process.cwd()
const ralphDir = join(repoRoot, ".ralph")

const checkRequiredFiles = (): { missing: string[]; exists: boolean } => {
  const requiredFiles = ["prompt.md", "todo.md", "progress.md"]
  const missing = requiredFiles.filter(file => !existsSync(join(ralphDir, file)))
  return { missing, exists: missing.length === 0 }
}

export const IterationRunner = ({ totalIterations }: Props) => {
  const { exit } = useApp()
  const [currentIteration, setCurrentIteration] = useState(1)
  const [events, setEvents] = useState<Array<Record<string, unknown>>>([])
  const [output, setOutput] = useState("")
  const [error, setError] = useState<string>()
  const [needsInit, setNeedsInit] = useState<string[] | null>(null)
  const [initializing, setInitializing] = useState(false)

  // Use refs for worktree/stash state to avoid triggering effect re-runs
  const currentWorktreeRef = useRef<WorktreeInfo | null>(null)
  const hasStashedChangesRef = useRef(false)

  // Only use input handling if stdin supports raw mode
  const stdinSupportsRawMode = process.stdin.isTTY === true

  // Cleanup function for worktrees and stash
  const cleanup = () => {
    try {
      if (currentWorktreeRef.current) {
        const gitRoot = getGitRoot(repoRoot)
        cleanupWorktree(gitRoot, currentWorktreeRef.current)
        currentWorktreeRef.current = null
      }
      if (hasStashedChangesRef.current) {
        const gitRoot = getGitRoot(repoRoot)
        popStash(gitRoot)
        hasStashedChangesRef.current = false
      }
    } catch (err) {
      console.error(`Cleanup error: ${err}`)
    }
  }

  // Handle process exit signals
  useEffect(() => {
    process.on("SIGINT", cleanup)
    process.on("SIGTERM", cleanup)

    return () => {
      process.off("SIGINT", cleanup)
      process.off("SIGTERM", cleanup)
    }
  }, [])

  const handleInitSelection = (item: { value: string }) => {
    if (item.value === "yes") {
      setInitializing(true)
      try {
        // Run ralph init in a separate process
        execSync("pnpm ralph init", { stdio: "inherit" })
        setTimeout(() => {
          exit()
          process.exit(0)
        }, 100)
      } catch (err) {
        setError(`Failed to initialize: ${err instanceof Error ? err.message : String(err)}`)
        setTimeout(() => {
          exit()
          process.exit(1)
        }, 100)
      }
    } else {
      setTimeout(() => {
        exit()
        process.exit(1)
      }, 100)
    }
  }

  useEffect(() => {
    if (currentIteration > totalIterations) {
      // Clean up and exit
      cleanup()
      exit()
      return
    }

    // Check if required files exist
    const { missing, exists } = checkRequiredFiles()
    if (!exists) {
      setNeedsInit(missing)
      // If stdin doesn't support raw mode, exit after showing the message
      if (!stdinSupportsRawMode) {
        setTimeout(() => {
          exit()
          process.exit(1)
        }, 100)
      }
      return
    }

    let worktree: WorktreeInfo | null = null

    try {
      const gitRoot = getGitRoot(repoRoot)

      // Stash changes before first iteration
      if (currentIteration === 1) {
        const hasChanges = stashChanges(gitRoot)
        hasStashedChangesRef.current = hasChanges
      }

      // Create worktree for this iteration
      worktree = createWorktree(gitRoot)
      currentWorktreeRef.current = worktree

      // Copy .ralph files to worktree
      copyRalphFilesToWorktree(gitRoot, worktree.path)

      // Install dependencies if package.json exists
      installDependencies(worktree.path)

      // Clear events for this iteration
      setEvents([])
      setOutput("")

      // Ensure .ralph directory exists in worktree
      const worktreeRalphDir = join(worktree.path, ".ralph")
      mkdirSync(worktreeRalphDir, { recursive: true })

      const child = spawn(
        "claude",
        [
          "--permission-mode",
          "bypassPermissions",
          "-p",
          "@.ralph/prompt.md",
          "@.ralph/todo.md",
          "@.ralph/progress.md",
          "--output-format",
          "stream-json",
          "--include-partial-messages",
          "--verbose",
        ],
        {
          stdio: ["inherit", "pipe", "inherit"],
          cwd: worktree.path,
        },
      )

      let fullOutput = ""
      let stdoutEnded = false
      let closeInfo: { code: number | null; signal: NodeJS.Signals | null } | null = null

      const handleIterationComplete = () => {
        if (!stdoutEnded || !closeInfo || !worktree) return

        const { code, signal } = closeInfo
        const gitRoot = getGitRoot(repoRoot)

        // Handle error exit
        if (code !== 0) {
          setError(
            `Claude exited with code ${code}${
              signal ? ` (signal: ${signal})` : ""
            }\n\nLast 2000 chars:\n${fullOutput.slice(-2000)}`,
          )
          cleanupWorktree(gitRoot, worktree)
          currentWorktreeRef.current = null
          setTimeout(() => {
            cleanup()
            exit()
            process.exit(1)
          }, 100)
          return
        }

        // Merge worktree changes back to main
        try {
          copyRalphFilesFromWorktree(gitRoot, worktree.path)
          mergeWorktreeToMain(gitRoot, worktree)
          cleanupWorktree(gitRoot, worktree)
          currentWorktreeRef.current = null
        } catch (err) {
          setError(`Failed to merge worktree: ${err}`)
          cleanupWorktree(gitRoot, worktree)
          currentWorktreeRef.current = null
          setTimeout(() => {
            cleanup()
            exit()
            process.exit(1)
          }, 100)
          return
        }

        // Check if complete
        if (fullOutput.includes("<promise>COMPLETE</promise>")) {
          cleanup()
          exit()
          process.exit(0)
          return
        }

        // Move to next iteration
        setTimeout(() => setCurrentIteration(i => i + 1), 500)
      }

      const worktreeLogFile = join(worktree.path, ".ralph", "events.log")

      child.stdout.on("data", data => {
        const chunk = data.toString()
        for (const line of chunk.split("\n")) {
          if (!line.trim()) continue
          try {
            const event = JSON.parse(line)
            appendFileSync(worktreeLogFile, JSON.stringify(event, null, 2) + "\n\n")
            setEvents(prev => [...prev, event])
          } catch {
            // Incomplete JSON line, ignore
          }
        }
        fullOutput += chunk
        setOutput(fullOutput)
      })

      child.stdout.on("end", () => {
        stdoutEnded = true
        handleIterationComplete()
      })

      child.on("close", (code, signal) => {
        closeInfo = { code, signal }
        handleIterationComplete()
      })

      child.on("error", error => {
        setError(`Error running Claude: ${error.message}`)
        if (worktree) {
          const gitRoot = getGitRoot(repoRoot)
          cleanupWorktree(gitRoot, worktree)
          currentWorktreeRef.current = null
        }
        setTimeout(() => {
          cleanup()
          exit()
          process.exit(1)
        }, 100)
      })

      return () => {
        child.kill()
      }
    } catch (err) {
      setError(`Failed to set up worktree: ${err}`)
      if (worktree) {
        try {
          const gitRoot = getGitRoot(repoRoot)
          cleanupWorktree(gitRoot, worktree)
          currentWorktreeRef.current = null
        } catch {
          // Ignore cleanup errors
        }
      }
      setTimeout(() => {
        cleanup()
        exit()
        process.exit(1)
      }, 100)
    }
  }, [currentIteration, totalIterations, exit])

  if (needsInit) {
    if (initializing) {
      return (
        <Box flexDirection="column" paddingY={1}>
          <Text color="cyan">Initializing ralph...</Text>
        </Box>
      )
    }

    return (
      <Box flexDirection="column" paddingY={1}>
        <Text color="yellow">Missing required files in .ralph directory:</Text>
        <Box flexDirection="column" paddingLeft={2} paddingY={1}>
          {needsInit.map(file => (
            <Text key={file} dimColor>
              • {file}
            </Text>
          ))}
        </Box>
        <Box marginTop={1}>
          {stdinSupportsRawMode ?
            <>
              <Text>Initialize now?</Text>
              <Box marginTop={1}>
                <SelectInput
                  items={[
                    { label: "Yes, initialize the project", value: "yes" },
                    { label: "No, exit", value: "no" },
                  ]}
                  onSelect={handleInitSelection}
                />
              </Box>
            </>
          : <Text>
              Run <Text color="cyan">ralph init</Text> to initialize the project.
            </Text>
          }
        </Box>
      </Box>
    )
  }

  if (error) {
    return (
      <Box flexDirection="column">
        <Text color="red">{error}</Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column">
      <Box borderStyle="round" borderColor="cyan" paddingX={1} marginTop={1} marginBottom={1}>
        <Text color="cyan">Iteration {currentIteration}</Text>
      </Box>
      <EventDisplay events={events} />
    </Box>
  )
}

type Props = {
  totalIterations: number
}
