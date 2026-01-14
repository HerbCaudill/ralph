import { Text, Box } from "ink"
import React, { useEffect, useState } from "react"
import { existsSync, mkdirSync, copyFileSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))

export const InitRalph = () => {
  const [status, setStatus] = useState<"checking" | "exists" | "creating" | "done">("checking")
  const [createdFiles, setCreatedFiles] = useState<string[]>([])
  const [errors, setErrors] = useState<string[]>([])

  useEffect(() => {
    const initialize = async () => {
      const ralphDir = join(process.cwd(), ".ralph")
      const templatesDir = join(__dirname, "..", "..", "templates")
      const templates = ["prompt.md", "todo.md"]

      // Check if .ralph exists and all files are present
      if (existsSync(ralphDir)) {
        const allFilesExist = templates.every(template => existsSync(join(ralphDir, template)))

        if (allFilesExist) {
          setStatus("exists")
          return
        }
        // If not all files exist, continue to create missing ones
      }

      setStatus("creating")

      try {
        mkdirSync(ralphDir, { recursive: true })

        const created: string[] = []
        const failed: string[] = []

        for (const template of templates) {
          const src = join(templatesDir, template)
          const dest = join(ralphDir, template)

          // Only copy if the destination doesn't exist
          if (!existsSync(dest)) {
            if (existsSync(src)) {
              copyFileSync(src, dest)
              created.push(template)
            } else {
              failed.push(`Template not found: ${template}`)
            }
          }
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
  }, [])

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
          <Text bold>{"\n"}Before running ralph, you need to:</Text>
          <Text>
            <Text color="cyan"> 1. Edit .ralph/prompt.md</Text>
            <Text dimColor> - Add your project context and workflow instructions</Text>
          </Text>
          <Text>
            <Text color="cyan"> 2. Edit .ralph/todo.md</Text>
            <Text dimColor> - Add the tasks you want Ralph to work on</Text>
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
