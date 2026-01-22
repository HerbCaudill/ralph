import { Text, Box } from "ink"
import React, { useEffect, useState } from "react"
import { existsSync, readFileSync, appendFileSync, writeFileSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import { copyTemplates } from "../lib/copyTemplates.js"

const __dirname = dirname(fileURLToPath(import.meta.url))

export function InitRalph() {
  const [status, setStatus] = useState<InitStatus>("checking")
  const [createdFiles, setCreatedFiles] = useState<string[]>([])
  const [skippedFiles, setSkippedFiles] = useState<string[]>([])
  const [errors, setErrors] = useState<string[]>([])

  // Check if .ralph already exists and run initialization
  useEffect(() => {
    const ralphDir = join(process.cwd(), ".ralph")
    const claudeDir = join(process.cwd(), ".claude")

    // Check if already initialized
    if (existsSync(join(ralphDir, "workflow.md"))) {
      setStatus("exists")
      return
    }

    // Run initialization
    const initialize = async () => {
      const templatesDir = join(__dirname, "..", "..", "templates")

      setStatus("creating")

      try {
        const allCreated: string[] = []
        const allSkipped: string[] = []
        const allErrors: string[] = []

        // Copy workflow to .ralph/
        const ralphResult = copyTemplates(templatesDir, ralphDir, [
          { src: "workflow.md", dest: "workflow.md" },
        ])
        allCreated.push(...ralphResult.created.map(f => `.ralph/${f}`))
        allSkipped.push(...ralphResult.skipped.map(f => `.ralph/${f}`))
        allErrors.push(...ralphResult.errors)

        // Copy skills to .claude/skills/
        const skillsResult = copyTemplates(templatesDir, claudeDir, [
          { src: "skills/manage-tasks/SKILL.md", dest: "skills/manage-tasks/SKILL.md" },
        ])
        allCreated.push(...skillsResult.created.map(f => `.claude/${f}`))
        allSkipped.push(...skillsResult.skipped.map(f => `.claude/${f}`))
        allErrors.push(...skillsResult.errors)

        // Copy agents to .claude/agents/
        const agentsResult = copyTemplates(templatesDir, claudeDir, [
          { src: "agents/make-tests.md", dest: "agents/make-tests.md" },
          { src: "agents/write-docs.md", dest: "agents/write-docs.md" },
          { src: "agents/run-tests.md", dest: "agents/run-tests.md" },
        ])
        allCreated.push(...agentsResult.created.map(f => `.claude/${f}`))
        allSkipped.push(...agentsResult.skipped.map(f => `.claude/${f}`))
        allErrors.push(...agentsResult.errors)

        // Add events log pattern to .gitignore
        const gitignorePath = join(process.cwd(), ".gitignore")
        const eventsLogEntry = ".ralph/events-*.jsonl"
        if (existsSync(gitignorePath)) {
          const content = readFileSync(gitignorePath, "utf-8")
          if (!content.includes(eventsLogEntry)) {
            const newline = content.endsWith("\n") ? "" : "\n"
            appendFileSync(gitignorePath, `${newline}${eventsLogEntry}\n`)
            allCreated.push("(added .ralph/events-*.jsonl to .gitignore)")
          }
        } else {
          writeFileSync(gitignorePath, `${eventsLogEntry}\n`)
          allCreated.push("(created .gitignore with .ralph/events-*.jsonl)")
        }

        setCreatedFiles(allCreated)
        setSkippedFiles(allSkipped)
        setErrors(allErrors)
        setStatus("done")

        // Exit after a brief delay so user can see success message
        setTimeout(() => process.exit(0), 100)
      } catch (error) {
        setErrors([`Failed to initialize: ${error}`])
        setStatus("done")
        setTimeout(() => process.exit(1), 100)
      }
    }

    initialize()
  }, [])

  if (status === "checking") {
    return <Text>Checking directories...</Text>
  }

  if (status === "exists") {
    return (
      <Box flexDirection="column">
        <Text color="yellow">Ralph is already initialized</Text>
        <Text dimColor>To reinitialize, remove the workflow first: rm .ralph/workflow.md</Text>
      </Box>
    )
  }

  if (status === "creating") {
    return <Text color="cyan">Initializing ralph...</Text>
  }

  return (
    <Box flexDirection="column">
      {createdFiles.map(file => (
        <Text key={file}>
          <Text color="green">✓</Text> Created <Text dimColor>{file}</Text>
        </Text>
      ))}
      {skippedFiles.map(file => (
        <Text key={file}>
          <Text color="yellow">○</Text> Skipped <Text dimColor>{file}</Text>
          <Text dimColor> (already exists)</Text>
        </Text>
      ))}
      {errors.map((error, i) => (
        <Text key={i}>
          <Text color="red">✗</Text> {error}
        </Text>
      ))}
      {errors.length === 0 && (
        <>
          <Text color="green">{"\n"}Ralph initialized successfully!</Text>
          <Text bold>{"\n"}Next steps:</Text>
          <Text>
            <Text color="cyan"> 1. Edit .ralph/workflow.md</Text>
            <Text dimColor> - Customize build commands for your project</Text>
          </Text>
          <Text>
            <Text color="cyan"> 2. Initialize beads</Text>
            <Text dimColor> - Run `bd init` to set up the issue tracker</Text>
          </Text>
          <Text>
            <Text color="cyan"> 3. Create issues</Text>
            <Text dimColor> - Run `bd create --title="..." --type=task` to add work</Text>
          </Text>
          <Text>
            <Text bold>{"\n"}Then run: </Text>
            <Text color="cyan">ralph</Text>
            {"\n"}
          </Text>
        </>
      )}
    </Box>
  )
}

type InitStatus = "checking" | "exists" | "creating" | "done"
