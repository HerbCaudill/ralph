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
  type ThemeListResponse,
  type ThemeDetailResponse,
  type UseVSCodeThemeReturn,
} from "./useVSCodeTheme"

export { useWorkspaces, type UseWorkspacesReturn } from "./useWorkspaces"

export {
  useEventLogs,
  type EventLogSummary,
  type UseEventLogsOptions,
  type UseEventLogsResult,
} from "./useEventLogs"
