export { useAutoScroll, type UseAutoScrollOptions, type UseAutoScrollReturn } from "./useAutoScroll"

export {
  useWebSocket,
  type UseWebSocketOptions,
  type UseWebSocketReturn,
  type ConnectionStatus,
} from "./useWebSocket"

export { useRalphConnection, type UseRalphConnectionReturn } from "./useRalphConnection"

export {
  useHotkeys,
  type HotkeyHandler,
  type UseHotkeysOptions,
  type UseHotkeysReturn,
} from "./useHotkeys"

export { useTheme, getStoredTheme, type UseThemeReturn } from "./useTheme"

export { useTasks, type UseTasksOptions, type UseTasksResult } from "./useTasks"

export { useTaskDialog, type UseTaskDialogOptions, type UseTaskDialogResult } from "./useTaskDialog"

export { useStreamingState } from "./useStreamingState"
export type {
  StreamingMessage,
  StreamingContentBlock,
  StreamingTextBlock,
  StreamingToolUseBlock,
} from "@/types"

export {
  useEventLogRouter,
  parseEventLogHash,
  buildEventLogHash,
  type UseEventLogRouterReturn,
} from "./useEventLogRouter"

export {
  useTaskDialogRouter,
  parseTaskIdHash,
  buildTaskIdHash,
  type UseTaskDialogRouterOptions,
  type UseTaskDialogRouterReturn,
} from "./useTaskDialogRouter"

export {
  useVSCodeTheme,
  getLastThemeIdForMode,
  type ThemeListResponse,
  type ThemeDetailResponse,
  type UseVSCodeThemeReturn,
} from "./useVSCodeTheme"

export { useThemeCoordinator, type UseThemeCoordinatorReturn } from "./useThemeCoordinator"

export { useWorkspaces, type UseWorkspacesReturn } from "./useWorkspaces"

export {
  useEventLogs,
  type EventLogSummary,
  type UseEventLogsOptions,
  type UseEventLogsResult,
} from "./useEventLogs"

export {
  useIterations,
  type IterationSummary,
  type UseIterationsOptions,
  type UseIterationsResult,
} from "./useIterations"

export {
  useIterationPersistence,
  type UseIterationPersistenceOptions,
  type UseIterationPersistenceResult,
} from "./useIterationPersistence"

export {
  useEventPersistence,
  type UseEventPersistenceOptions,
  type UseEventPersistenceResult,
} from "./useEventPersistence"

export {
  useTaskChatPersistence,
  type UseTaskChatPersistenceOptions,
  type UseTaskChatPersistenceResult,
} from "./useTaskChatPersistence"

export {
  useStoreHydration,
  type UseStoreHydrationOptions,
  type UseStoreHydrationResult,
} from "./useStoreHydration"

export {
  useTaskChatSessions,
  type UseTaskChatSessionsOptions,
  type UseTaskChatSessionsResult,
} from "./useTaskChatSessions"

export { useTaskChat, type UseTaskChatResult } from "./useTaskChat"

export {
  useTaskDetails,
  type IssueType,
  type UseTaskDetailsOptions,
  type TaskFormValues,
  type UseTaskDetailsResult,
} from "./useTaskDetails"

export {
  useEventStream,
  type IterationTask,
  type IterationNavigationActions,
  type UseEventStreamOptions,
  type UseEventStreamResult,
} from "./useEventStream"

export { useTasksWithEventLogs, type UseTasksWithEventLogsResult } from "./useTasksWithEventLogs"
