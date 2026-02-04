export {
  useAutoScroll,
  type UseAutoScrollOptions,
  type UseAutoScrollReturn,
} from "@herbcaudill/agent-view"

export { useRalphConnection, type UseRalphConnectionReturn } from "./useRalphConnection"

export {
  useHotkeys,
  type HotkeyHandler,
  type UseHotkeysOptions,
  type UseHotkeysReturn,
} from "./useHotkeys"

export { useTheme, type UseThemeReturn } from "./useTheme"

export { useTasks, type UseTasksOptions, type UseTasksResult } from "./useTasks"

export { useTaskDialog, type UseTaskDialogOptions, type UseTaskDialogResult } from "./useTaskDialog"

export { useStreamingState } from "@herbcaudill/agent-view"
export type {
  StreamingMessage,
  StreamingContentBlock,
  StreamingTextBlock,
  StreamingToolUseBlock,
} from "@/types"

export {
  parseEventLogHash,
  buildEventLogHash,
  parseSessionIdFromUrl,
  buildSessionPath,
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
  useSessions,
  type SessionSummary,
  type SessionWithEvents,
  type UseSessionsOptions,
  type UseSessionsResult,
} from "./useSessions"

export {
  useSessionPersistence,
  type UseSessionPersistenceOptions,
  type UseSessionPersistenceResult,
} from "./useSessionPersistence"

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
  type SessionTask,
  type SessionNavigationActions,
  type UseEventStreamOptions,
  type UseEventStreamResult,
} from "./useEventStream"

export { useTasksWithSessions, type UseTasksWithSessionsResult } from "./useTasksWithSessions"

export { useFavicon } from "./useFavicon"

export { useDevStateExport, type UseDevStateExportOptions } from "./useDevStateExport"
