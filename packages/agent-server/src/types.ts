/** Configuration for the agent server. */
export interface AgentServerConfig {
  /** Hostname to listen on (default: "localhost"). */
  host: string
  /** Port to listen on (default: 4244). */
  port: number
  /** Directory to store session JSONL files (default: ".agent-sessions"). */
  storageDir?: string
  /** Default working directory for agents. */
  cwd?: string
}
