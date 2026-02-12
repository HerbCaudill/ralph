import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

/** Path to the shared templates directory containing core.prompt.md and workflow.prompt.md. */
export const TEMPLATES_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "templates")
