import type { Meta, StoryObj } from "@storybook/react-vite"
import { useState, useMemo, useCallback } from "react"
import { IconHistory, IconClock, IconMessage } from "@tabler/icons-react"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn, stripTaskPrefix } from "@/lib/utils"
import type { TaskChatSessionMetadata } from "@/lib/persistence"

/**
 * Presentational version of TaskChatHistoryDropdown for Storybook.
 * Accepts sessions data directly instead of using the hook.
 */
function TaskChatHistoryDropdownStory({
  className,
  onSelectSession,
  sessions,
  isLoading,
  error,
  issuePrefix,
}: {
  className?: string
  onSelectSession?: (sessionId: string) => void
  sessions: TaskChatSessionMetadata[]
  isLoading: boolean
  error: string | null
  issuePrefix: string | null
}) {
  const [open, setOpen] = useState(false)

  /** Groups task chat sessions by date (Today, Yesterday, or specific date). */
  const groupedSessions = useMemo(() => {
    const groups = new Map<string, TaskChatSessionMetadata[]>()

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)

    for (const session of sessions) {
      const sessionDate = new Date(session.updatedAt)
      const sessionDay = new Date(
        sessionDate.getFullYear(),
        sessionDate.getMonth(),
        sessionDate.getDate(),
      )

      let dateLabel: string
      if (sessionDay.getTime() === today.getTime()) {
        dateLabel = "Today"
      } else if (sessionDay.getTime() === yesterday.getTime()) {
        dateLabel = "Yesterday"
      } else {
        dateLabel = sessionDay.toLocaleDateString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
        })
      }

      const existing = groups.get(dateLabel)
      if (existing) {
        existing.push(session)
      } else {
        groups.set(dateLabel, [session])
      }
    }

    return Array.from(groups.entries()).map(([dateLabel, sessions]) => ({ dateLabel, sessions }))
  }, [sessions])

  /** Formats a timestamp to show only the time. */
  const formatSessionTime = (timestamp: number): string => {
    return new Date(timestamp).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const handleSelectSession = useCallback(
    (sessionId: string) => {
      onSelectSession?.(sessionId)
      setOpen(false)
    },
    [onSelectSession],
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "text-muted-foreground hover:text-foreground rounded p-1 transition-colors",
            className,
          )}
          aria-label="View chat history"
          title="Chat history"
          data-testid="task-chat-history-dropdown-trigger"
        >
          <IconHistory className="size-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <Command>
          <CommandInput placeholder="Search chat sessions..." />
          <CommandList>
            <CommandEmpty>
              {isLoading ?
                "Loading..."
              : error ?
                error
              : "No chat sessions found."}
            </CommandEmpty>

            {!isLoading &&
              !error &&
              groupedSessions.map(({ dateLabel, sessions }) => (
                <CommandGroup key={dateLabel} heading={dateLabel}>
                  {sessions.map(session => (
                    <CommandItem
                      key={session.id}
                      value={`${session.taskId || ""} ${session.taskTitle || ""} ${session.id}`}
                      onSelect={() => handleSelectSession(session.id)}
                      className="flex items-center gap-2"
                    >
                      <IconHistory className="text-muted-foreground size-4 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          {session.taskId && session.taskId !== "untitled" && (
                            <span className="text-muted-foreground shrink-0 font-mono text-xs">
                              {stripTaskPrefix(session.taskId, issuePrefix)}
                            </span>
                          )}
                          <span className="truncate text-sm">
                            {session.taskTitle ||
                              (session.taskId && session.taskId !== "untitled" ?
                                ""
                              : "General chat")}
                          </span>
                        </div>
                        <div className="text-muted-foreground flex items-center gap-2 text-xs">
                          <span className="flex items-center gap-0.5">
                            <IconClock className="size-3" />
                            {formatSessionTime(session.updatedAt)}
                          </span>
                          <span className="flex items-center gap-0.5">
                            <IconMessage className="size-3" />
                            {session.messageCount}
                          </span>
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

// Helper to create session metadata
function createSession(
  id: string,
  taskId: string,
  taskTitle: string | null,
  updatedAt: number,
  messageCount: number,
): TaskChatSessionMetadata {
  return {
    id,
    taskId,
    taskTitle,
    instanceId: "default",
    createdAt: updatedAt - 3600000,
    updatedAt,
    messageCount,
    eventCount: messageCount * 2,
    lastEventSequence: messageCount * 2,
  }
}

// Time helpers
const now = Date.now()
const oneHourAgo = now - 3600000
const twoHoursAgo = now - 7200000
const yesterday = now - 86400000
const twoDaysAgo = now - 172800000

const meta: Meta<typeof TaskChatHistoryDropdownStory> = {
  title: "Chat/TaskChatHistoryDropdown",
  component: TaskChatHistoryDropdownStory,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  decorators: [
    Story => (
      <div className="p-8">
        <Story />
      </div>
    ),
  ],
  args: {
    sessions: [],
    isLoading: false,
    error: null,
    issuePrefix: "PROJ-",
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    sessions: [
      createSession("session-1", "PROJ-123", "Fix authentication bug", oneHourAgo, 5),
      createSession("session-2", "PROJ-124", "Add dark mode support", twoHoursAgo, 12),
      createSession("session-3", "PROJ-125", "Refactor API endpoints", yesterday, 8),
      createSession("session-4", "PROJ-126", "Update documentation", twoDaysAgo, 3),
    ],
    onSelectSession: sessionId => console.log("Selected session:", sessionId),
  },
}

export const Loading: Story = {
  args: {
    sessions: [],
    isLoading: true,
    error: null,
  },
}

export const Empty: Story = {
  args: {
    sessions: [],
    isLoading: false,
    error: null,
  },
}

export const WithError: Story = {
  args: {
    sessions: [],
    isLoading: false,
    error: "Failed to connect to database",
  },
}

export const ManySessions: Story = {
  args: {
    sessions: [
      // Today's sessions
      ...Array.from({ length: 5 }, (_, i) =>
        createSession(
          `today-${i}`,
          `PROJ-${100 + i}`,
          `Task ${i + 1} - Today`,
          now - i * 1800000,
          Math.floor(Math.random() * 20) + 1,
        ),
      ),
      // Yesterday's sessions
      ...Array.from({ length: 3 }, (_, i) =>
        createSession(
          `yesterday-${i}`,
          `PROJ-${200 + i}`,
          `Task ${i + 1} - Yesterday`,
          yesterday - i * 3600000,
          Math.floor(Math.random() * 20) + 1,
        ),
      ),
      // Older sessions
      ...Array.from({ length: 4 }, (_, i) =>
        createSession(
          `older-${i}`,
          `PROJ-${300 + i}`,
          `Task ${i + 1} - Older`,
          twoDaysAgo - i * 86400000,
          Math.floor(Math.random() * 20) + 1,
        ),
      ),
    ],
    onSelectSession: sessionId => console.log("Selected session:", sessionId),
  },
}

export const UntitledTask: Story = {
  args: {
    sessions: [
      createSession("session-1", "PROJ-123", null, oneHourAgo, 5),
      createSession("session-2", "untitled", null, twoHoursAgo, 3),
    ],
    onSelectSession: sessionId => console.log("Selected session:", sessionId),
  },
}

export const WithLongTitles: Story = {
  args: {
    sessions: [
      createSession(
        "session-1",
        "PROJ-123",
        "This is a very long task title that should truncate properly in the dropdown menu when it overflows",
        oneHourAgo,
        15,
      ),
      createSession(
        "session-2",
        "PROJ-124",
        "Another extremely long title to test the truncation behavior of the component",
        twoHoursAgo,
        8,
      ),
    ],
    onSelectSession: sessionId => console.log("Selected session:", sessionId),
  },
}

export const NoIssuePrefix: Story = {
  args: {
    sessions: [
      createSession("session-1", "fix-auth-bug", "Fix authentication bug", oneHourAgo, 5),
      createSession("session-2", "add-dark-mode", "Add dark mode support", twoHoursAgo, 12),
    ],
    issuePrefix: null,
    onSelectSession: sessionId => console.log("Selected session:", sessionId),
  },
}
