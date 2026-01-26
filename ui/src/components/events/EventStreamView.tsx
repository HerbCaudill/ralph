import { useMemo, forwardRef } from "react"
import { cn } from "@/lib/utils"
import { ContentStreamContainer } from "@/components/shared/ContentStreamContainer"
import { TopologySpinner } from "@/components/ui/TopologySpinner"
import { EventList, useEventListState } from "./EventList"
import { EventStreamSessionBar } from "./EventStreamSessionBar"
import type { SessionSummary } from "@/hooks"
import type { SessionTask, SessionNavigationActions } from "@/hooks/useEventStream"
import type { ChatEvent, RalphStatus } from "@/types"

/**
 * Props for the presentational EventStreamView component.
 * All data and callbacks are passed as props - no store access.
 */
export interface EventStreamViewProps {
  /** Optional CSS class to apply to the container */
  className?: string
  /** Maximum number of events to display */
  maxEvents?: number
  /** Events for the current session */
  sessionEvents: ChatEvent[]
  /** Ralph status (running, stopped, etc.) */
  ralphStatus: RalphStatus
  /** Whether viewing the latest session */
  isViewingLatest: boolean
  /** Whether Ralph is currently running */
  isRunning: boolean
  /** Current task for the session */
  sessionTask: SessionTask | null
  /** Past sessions for history dropdown */
  sessions: SessionSummary[]
  /** Whether sessions are loading */
  isLoadingSessions: boolean
  /** Issue prefix for the workspace */
  issuePrefix: string | null
  /** Navigation actions */
  navigation: SessionNavigationActions
}

/**
 * Presentational component for displaying real-time events from ralph.
 * Auto-scrolls to bottom, pauses on user interaction.
 *
 * This component receives all data via props and has no store access.
 * Use the EventStream component (which uses useEventStream hook) for
 * the connected version.
 */
export const EventStreamView = forwardRef<HTMLDivElement, EventStreamViewProps>(
  function EventStreamView(
    {
      className,
      maxEvents = 1000,
      sessionEvents,
      // ralphStatus is passed for potential future use but currently derived values (isRunning) are used
      ralphStatus: _ralphStatus,
      isViewingLatest,
      isRunning,
      sessionTask,
      sessions,
      isLoadingSessions,
      issuePrefix,
      navigation,
    },
    ref,
  ) {
    // Use the shared hook to get content state for empty state handling
    const { hasContent } = useEventListState(sessionEvents, maxEvents)

    // Show active spinner when running, stopped spinner when idle with content
    const bottomIndicator = useMemo(() => {
      if (isRunning && isViewingLatest) {
        return (
          <div
            className="flex items-center justify-start px-4 py-4"
            aria-label="Ralph is running"
            data-testid="ralph-running-spinner"
          >
            <TopologySpinner />
          </div>
        )
      }
      if (hasContent && isViewingLatest) {
        return (
          <div
            className="flex items-center justify-start px-4 py-4"
            aria-label="Ralph is idle"
            data-testid="ralph-idle-spinner"
          >
            <TopologySpinner stopped />
          </div>
        )
      }
      return null
    }, [isRunning, isViewingLatest, hasContent])

    const emptyState = (
      <div className="flex h-full items-center justify-start px-4 py-4">
        <TopologySpinner />
      </div>
    )

    return (
      <div ref={ref} className={cn("relative flex h-full flex-col", className)}>
        <EventStreamSessionBar
          currentTask={sessionTask}
          sessions={sessions}
          isLoadingSessions={isLoadingSessions}
          issuePrefix={issuePrefix}
          isRunning={isRunning}
          onSessionHistorySelect={navigation.selectSessionHistory}
        />

        <ContentStreamContainer
          className="flex-1"
          ariaLabel="Event stream"
          dependencies={[sessionEvents]}
          emptyState={emptyState}
          autoScrollEnabled={isViewingLatest}
        >
          {hasContent ?
            <EventList
              events={sessionEvents}
              maxEvents={maxEvents}
              loadingIndicator={bottomIndicator}
            />
          : null}
        </ContentStreamContainer>
      </div>
    )
  },
)
