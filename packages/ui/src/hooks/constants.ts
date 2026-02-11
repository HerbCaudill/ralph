/** Tools allowed in task chat sessions (read-only investigation + shell/search). */
export const TASK_CHAT_ALLOWED_TOOLS = [
  "Read",
  "Glob",
  "Grep",
  "LS",
  "Bash",
  "Task",
  "WebFetch",
  "WebSearch",
] as const
