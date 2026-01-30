const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  ts: "typescript",
  tsx: "tsx",
  js: "javascript",
  jsx: "jsx",
  json: "json",
  html: "html",
  css: "css",
  scss: "css",
  less: "css",
  md: "markdown",
  py: "python",
  rs: "rust",
  go: "go",
  rb: "ruby",
  java: "java",
  c: "c",
  cpp: "cpp",
  h: "c",
  hpp: "cpp",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  yml: "yaml",
  yaml: "yaml",
  toml: "toml",
  xml: "xml",
  sql: "sql",
  graphql: "graphql",
  gql: "graphql",
}

export function getLanguageFromFilePath(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase()
  return ext ? EXTENSION_TO_LANGUAGE[ext] || "text" : "text"
}
