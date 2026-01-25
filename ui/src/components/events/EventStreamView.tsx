import { useMemo, forwardRef } from "react"
import { cn } from "@/lib/utils"
import { ContentStreamContainer } from "@/components/shared/ContentStreamContainer"
import { TopologySpinner } from "@/components/ui/TopologySpinner"
import { EventList, useEventListState } from "./EventList"
import { EventStreamIterationBar } from "./EventStreamIterationBar"
import type { EventLogSummary } from "@/hooks"
import type { IterationTask, IterationNavigationActions } from "@/hooks/useEventStream"
import type { IterationTaskInfo } from "@/store"
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
  /** Events for the current iteration */
  iterationEvents: ChatEvent[]
  /** Ralph status (running, stopped, etc.) */
  ralphStatus: RalphStatus
  /** Current iteration index being viewed (null = latest) */
  viewingIterationIndex: number | null
  /** Whether viewing the latest iteration */
  isViewingLatest: boolean
  /** Whether Ralph is currently running */
  isRunning: boolean
  /** Total number of iterations */
  iterationCount: number
  /** Displayed iteration number (1-based) */
  displayedIteration: number
  /** Current task for the iteration */
  iterationTask: IterationTask | null
  /** Task info for all iterations (indexed by iteration) */
  iterationTaskInfos: IterationTaskInfo[]
  /** Event logs for history dropdown */
  eventLogs: EventLogSummary[]
  /** Whether event logs are loading */
  isLoadingEventLogs: boolean
  /** Issue prefix for the workspace */
  issuePrefix: string | null
  /** Navigation actions */
  navigation: IterationNavigationActions
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
      iterationEvents,
      // ralphStatus is passed for potential future use but currently derived values (isRunning) are used
      ralphStatus: _ralphStatus,
      viewingIterationIndex,
      isViewingLatest,
      isRunning,
      iterationCount,
      displayedIteration,
      iterationTask,
      iterationTaskInfos,
      eventLogs,
      isLoadingEventLogs,
      issuePrefix,
      navigation,
    },
    ref,
  ) {
    // Use the shared hook to get content state for empty state handling
    const { hasContent } = useEventListState(iterationEvents, maxEvents)

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
        <EventStreamIterationBar
          iterationCount={iterationCount}
          displayedIteration={displayedIteration}
          isViewingLatest={isViewingLatest}
          viewingIterationIndex={viewingIterationIndex}
          currentTask={iterationTask}
          iterationTaskInfos={iterationTaskInfos}
          eventLogs={eventLogs}
          isLoadingEventLogs={isLoadingEventLogs}
          issuePrefix={issuePrefix}
          onPrevious={navigation.goToPrevious}
          onNext={navigation.goToNext}
          onLatest={navigation.goToLatest}
          onIterationSelect={navigation.selectIteration}
          onEventLogSelect={navigation.selectEventLog}
        />

        <ContentStreamContainer
          className="flex-1"
          ariaLabel="Event stream"
          dependencies={[iterationEvents]}
          emptyState={emptyState}
          autoScrollEnabled={isViewingLatest}
        >
          {hasContent ?
            <EventList
              events={iterationEvents}
              maxEvents={maxEvents}
              loadingIndicator={bottomIndicator}
            />
          : null}
        </ContentStreamContainer>
      </div>
    )
  },
)
