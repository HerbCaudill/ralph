import { Text, Box } from "ink"
import SelectInput from "ink-select-input"
import React, { useEffect, useState } from "react"
import {
  existsSync,
  mkdirSync,
  copyFileSync,
  readFileSync,
  appendFileSync,
  writeFileSync,
} from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))

type TaskMode = "todo" | "beads"

export const InitRalph = () => {
  const [status, setStatus] = useState<"checking" | "exists" | "selecting" | "creating" | "done">(
    "checking",
  )
  const [taskMode, setTaskMode] = useState<TaskMode | null>(null)
  const [createdFiles, setCreatedFiles] = useState<string[]>([])
  const [errors, setErrors] = useState<string[]>([])

  // Check if .ralph already exists
  useEffect(() => {
    const ralphDir = join(process.cwd(), ".ralph")

    if (existsSync(ralphDir) && existsSync(join(ralphDir, "prompt.md"))) {
      setStatus("exists")
    } else {
      setStatus("selecting")
    }
  }, [])

  // Run initialization when task mode is selected
  useEffect(() => {
    if (!taskMode) return

    const initialize = async () => {
      const ralphDir = join(process.cwd(), ".ralph")
      const templatesDir = join(__dirname, "..", "..", "templates")

      // Select templates based on task mode
      const templates: Array<{ src: string; dest: string }> =
        taskMode === "beads" ?
          [{ src: "prompt-beads.md", dest: "prompt.md" }]
        : [
            { src: "prompt-todos.md", dest: "prompt.md" },
            { src: "todo.md", dest: "todo.md" },
          ]

      setStatus("creating")

      try {
        mkdirSync(ralphDir, { recursive: true })

        const created: string[] = []
        const failed: string[] = []

        for (const template of templates) {
          const src = join(templatesDir, template.src)
          const dest = join(ralphDir, template.dest)

          // Only copy if the destination doesn't exist
          if (!existsSync(dest)) {
            if (existsSync(src)) {
              copyFileSync(src, dest)
              created.push(template.dest)
            } else {
              failed.push(`Template not found: ${template.src}`)
            }
          }
        }

        // Add events.log to .gitignore
        const gitignorePath = join(process.cwd(), ".gitignore")
        const eventsLogEntry = ".ralph/events.log"
        if (existsSync(gitignorePath)) {
          const content = readFileSync(gitignorePath, "utf-8")
          if (!content.includes(eventsLogEntry)) {
            const newline = content.endsWith("\n") ? "" : "\n"
            appendFileSync(gitignorePath, `${newline}${eventsLogEntry}\n`)
            created.push("(added .ralph/events.log to .gitignore)")
          }
        } else {
          writeFileSync(gitignorePath, `${eventsLogEntry}\n`)
          created.push("(created .gitignore with .ralph/events.log)")
        }

        setCreatedFiles(created)
        setErrors(failed)
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
  }, [taskMode])

  const handleModeSelect = (item: { value: string }) => {
    setTaskMode(item.value as TaskMode)
  }

  if (status === "checking") {
    return <Text>Checking .ralph directory...</Text>
  }

  if (status === "exists") {
    return (
      <Box flexDirection="column">
        <Text color="yellow">⚠️ .ralph directory already exists</Text>
        <Text dimColor>To reinitialize, remove the directory first: rm -rf .ralph</Text>
      </Box>
    )
  }

  if (status === "selecting") {
    return (
      <Box flexDirection="column">
        <Text bold>How will you manage tasks?</Text>
        <Box marginTop={1}>
          <SelectInput
            items={[
              { label: "todo.md - Simple markdown checklist", value: "todo" },
              { label: "beads - Git-backed issue tracker", value: "beads" },
            ]}
            onSelect={handleModeSelect}
          />
        </Box>
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
          <Text color="green">✓</Text> Created <Text dimColor>.ralph/{file}</Text>
        </Text>
      ))}
      {errors.map((error, i) => (
        <Text key={i}>
          <Text color="red">✗</Text> {error}
        </Text>
      ))}
      {errors.length === 0 && (
        <>
          <Text color="green">{"\n"}✓ Ralph initialized successfully!</Text>
          {taskMode === "todo" ?
            <>
              <Text bold>{"\n"}Before running ralph, you need to:</Text>
              <Text>
                <Text color="cyan"> 1. Edit .ralph/prompt.md</Text>
                <Text dimColor> - Add your project context and workflow instructions</Text>
              </Text>
              <Text>
                <Text color="cyan"> 2. Edit .ralph/todo.md</Text>
                <Text dimColor> - Add the tasks you want Ralph to work on</Text>
              </Text>
            </>
          : <>
              <Text bold>{"\n"}Before running ralph, you need to:</Text>
              <Text>
                <Text color="cyan"> 1. Edit .ralph/prompt.md</Text>
                <Text dimColor> - Customize build commands and workflow for your project</Text>
              </Text>
              <Text>
                <Text color="cyan"> 2. Initialize beads</Text>
                <Text dimColor> - Run `bd init` to set up the issue tracker</Text>
              </Text>
              <Text>
                <Text color="cyan"> 3. Create issues</Text>
                <Text dimColor> - Run `bd create --title="..." --type=task` to add work</Text>
              </Text>
            </>
          }
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
