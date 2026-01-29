import { useMemo, forwardRef } from "react"
import { IconPlayerPlayFilled } from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import { ContentStreamContainer } from "@/components/shared/ContentStreamContainer"
import { TopologySpinner } from "@/components/ui/TopologySpinner"
import { Button } from "@/components/ui/button"
import { EventList, useEventListState } from "./EventList"
import { EventStreamSessionBar } from "./EventStreamSessionBar"
import { startRalph } from "@/lib/startRalph"
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
  /** Whether viewing a historical session from IndexedDB */
  isViewingHistorical: boolean
  /** Whether Ralph is currently running */
  isRunning: boolean
  /** Whether connected to the server */
  isConnected: boolean
  /** Current task for the session */
  sessionTask: SessionTask | null
  /** Past sessions for history dropdown */
  sessions: SessionSummary[]
  /** Whether sessions are loading */
  isLoadingSessions: boolean
  /** Whether historical session events are loading */
  isLoadingHistoricalEvents: boolean
  /** Issue prefix for the workspace */
  issuePrefix: string | null
  /** ID of the currently viewed session (for highlighting in dropdown) */
  currentSessionId?: string | null
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
      ralphStatus,
      isViewingLatest,
      isViewingHistorical,
      isRunning,
      isConnected,
      sessionTask,
      sessions,
      isLoadingSessions,
      isLoadingHistoricalEvents,
      issuePrefix,
      currentSessionId,
      navigation,
    },
    ref,
  ) {
    // Use the shared hook to get content state for empty state handling
    const { hasContent } = useEventListState(sessionEvents, maxEvents)

    // Show active spinner when running, stopped spinner when idle with content
    // Don't show spinners when viewing historical sessions
    const bottomIndicator = useMemo(() => {
      if (isViewingHistorical) {
        return null
      }
      if (isRunning && isViewingLatest) {
        return (
          <div
            className="flex items-center justify-start px-4 pt-4"
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
            className="flex items-center justify-start px-4 pt-4"
            aria-label="Ralph is idle"
            data-testid="ralph-idle-spinner"
          >
            <TopologySpinner stopped />
          </div>
        )
      }
      return null
    }, [isRunning, isViewingLatest, isViewingHistorical, hasContent])

    // Show appropriate empty state based on context:
    // - Historical session with no events: show "no events" message
    // - Live session, stopped and connected: show Start button
    // - Otherwise: show spinner (loading/connecting)
    const emptyState = useMemo(() => {
      if (isViewingHistorical) {
        return (
          <div className="text-muted-foreground flex h-full items-center justify-center">
            <span className="text-sm">No events found for this session</span>
          </div>
        )
      }
      if (ralphStatus === "stopped" && isConnected) {
        return (
          <div className="flex h-full flex-col items-center justify-center gap-4">
            <div className="text-center">
              <div className="text-foreground text-lg font-medium">Ralph is not running</div>
              <div className="text-muted-foreground text-sm">
                Click Start to begin working on open tasks
              </div>
            </div>
            <Button onClick={() => startRalph()} size="lg" data-testid="ralph-start-button">
              <IconPlayerPlayFilled className="size-4" />
              Start
            </Button>
          </div>
        )
      }
      return (
        <div className="flex h-full items-center justify-start px-4 py-4">
          <TopologySpinner />
        </div>
      )
    }, [ralphStatus, isConnected, isViewingHistorical])

    const loadingHistoricalState = (
      <div className="text-muted-foreground flex h-full items-center justify-center">
        <div className="flex items-center gap-2">
          <div className="bg-muted-foreground/30 h-2 w-2 animate-pulse rounded-full" />
          <span className="text-sm">Loading session...</span>
        </div>
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
          isViewingHistorical={isViewingHistorical}
          currentSessionId={currentSessionId}
          onSessionHistorySelect={navigation.selectSessionHistory}
          onReturnToLive={navigation.returnToLive}
          onPreviousSession={navigation.goToPrevious}
          onNextSession={navigation.goToNext}
          hasPreviousSession={navigation.hasPrevious}
          hasNextSession={navigation.hasNext}
        />

        {isLoadingHistoricalEvents ?
          <div className="flex-1">{loadingHistoricalState}</div>
        : <ContentStreamContainer
            className="flex-1"
            ariaLabel="Event stream"
            dependencies={[sessionEvents]}
            emptyState={emptyState}
            autoScrollEnabled={isViewingLatest && !isViewingHistorical}
          >
            {hasContent ?
              <EventList
                events={sessionEvents}
                maxEvents={maxEvents}
                loadingIndicator={bottomIndicator}
              />
            : null}
          </ContentStreamContainer>
        }
      </div>
    )
  },
)
