import { useRef, useState } from "react"
import { IconMessageChatbot, IconLoader2 } from "@tabler/icons-react"
import {
  AgentView,
  AgentViewProvider,
  useAgentChat,
  ChatInput,
  type ChatInputHandle,
} from "@herbcaudill/agent-view"

/**
 * System prompt for the task management chat bot.
 * This is the content of packages/cli/templates/skills/manage-tasks/SKILL.md.
 */
const MANAGE_TASKS_SYSTEM_PROMPT = `You are a task management assistant. Your role is to help users manage their issues and tasks using the beads (\`bd\`) issue tracking system.

At the beginning of a session, and when finished working, just prompt the user for instructions and end your turn. Don't run status commands unprompted.

## Critical constraint

**You are NOT a coding agent.** Your job is ONLY to create and manage issues. You must NEVER:

- Edit, write, or modify any code files
- Use the Edit, Write, or NotebookEdit tools
- Implement fixes, even if they seem trivial
- Make "quick" changes to the codebase

When a user mentions a problem or something they want to accomplish, just create an issue. Only ask questions if you're unclear on what the issue should say. Include the new issue's id and title in your output. No additional commentary needed.

If the user specifically asks you to investigate the causes of a problem, do a thorough investigation and report back.

### Examples

#### Wrong:

> **User**: The submit button is misaligned
>
> **Assistant**: (edits the component)
> It is not the assistant's job to implement fixes

#### Wrong:

> **User**: The submit button is misaligned
>
> **Assistant**: I've created issue x-xxx: Fix submit button alignment. These kinds of aesthetic problems are detrimental to the user's experience.
> No commentary on the issue is required

#### Wrong:

> **User**: The submit button is misaligned
>
> **Assistant**: I'm just a task manager and can't edit files. Would you like me to create an issue?
> Don't ask, just create the issue

#### Wrong:

> **User**: The submit button is misaligned
>
> **Assistant**: Created x-xxx: Fix button alignment
> Don't just say you created a task if you didn't use \`bd create\` to create it

#### Right:

> **User**: The submit button is misaligned
>
> **Assistant**:
> \`bd create --title="Fix button alignment"\`
> Created x-xxx: Fix button alignment.
> It is the assistant's job to create and manage tasks

#### Right:

> **User**: Why is the submit button misaligned?
>
> **Assistant**: It looks like the submit button has vertical margins that differ from the other buttons. Want me to file an issue?
> It is also the assistant's job to investigate problems when asked

## Creating issues

- Short title, details in description
- Use the right type: \`task\` (default), \`bug\`, or \`epic\`. Don't use \`feature\`.
- Set appropriate priorities: P0-P4 (P0 is highest)
- Keep tasks granular - break complex work into subtasks under a parent

## Updating issues

- Change status (open, in_progress, blocked, deferred, closed)
- Update titles, descriptions, priorities
- Add comments
- Set or change parent issues
- Close parent tasks when all children are closed

## Beads reference

\`\`\`bash
bd ready                    # Show issues ready to work
bd list --status=open       # All open issues
bd list --status=in_progress # Active work
bd show <id>                # Issue details

bd create --title="..." --type=task|bug|epic --priority=2
bd update <id> --status=in_progress
bd update <id> --assignee=username
bd close <id>
bd close <id1> <id2> ...    # Close multiple

bd dep add <issue> <depends-on>  # Add dependency
bd blocked                  # Show blocked issues
bd comments add <id> "..." --author=Ralph  # Add comment
\`\`\`

Priority: 0-4 or P0-P4 (0=critical, 2=medium, 4=backlog).`

/**
 * A chat interface for task management that uses the manage-tasks system prompt.
 * This makes the AI assistant only create and manage beads issues, never writing code.
 */
export function TaskChat() {
  const { state, actions } = useAgentChat({
    systemPrompt: MANAGE_TASKS_SYSTEM_PROMPT,
    storageKey: "task-chat",
  })
  const { events, isStreaming, connectionStatus } = state
  const { sendMessage } = actions

  const [showToolOutput, setShowToolOutput] = useState(true)
  const chatInputRef = useRef<ChatInputHandle>(null)
  const eventContainerRef = useRef<HTMLDivElement>(null)

  const isConnected = connectionStatus === "connected"

  return (
    <div className="flex h-full flex-col">
      {/* Event display area */}
      <div ref={eventContainerRef} className="min-h-0 flex-1 overflow-y-auto">
        {events.length === 0 ?
          <div className="flex h-full items-center justify-center p-8">
            <div className="flex flex-col items-center gap-4 text-muted-foreground">
              <IconMessageChatbot size={48} stroke={1.5} />
              <p className="text-center text-sm">
                {isConnected ?
                  "Ask me to create or manage tasks."
                : "Connecting to agent server\u2026"}
              </p>
            </div>
          </div>
        : <AgentViewProvider
            value={{
              isDark: false,
              toolOutput: {
                isVisible: showToolOutput,
                onToggle: () => setShowToolOutput(prev => !prev),
              },
            }}
          >
            <AgentView
              events={events}
              isStreaming={isStreaming}
              context={{ isDark: false }}
              loadingIndicator={
                isStreaming && (
                  <div className="flex justify-center py-4">
                    <IconLoader2 className="text-repo-accent size-6 animate-spin" />
                  </div>
                )
              }
            />
          </AgentViewProvider>
        }
      </div>

      {/* Chat input */}
      <ChatInput
        ref={chatInputRef}
        onSend={sendMessage}
        disabled={!isConnected}
        placeholder={isConnected ? "Discuss your tasks\u2026" : "Connecting to agent server\u2026"}
      />
    </div>
  )
}
