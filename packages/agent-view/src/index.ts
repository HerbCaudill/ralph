// Components: Top-level
export { AgentView } from "./components/AgentView"
export type { AgentViewProps } from "./components/AgentView"

// Components: Events
export { AnsiOutput } from "./components/AnsiOutput"
export { AssistantText } from "./components/AssistantText"
export { DiffView } from "./components/DiffView"
export { ErrorEvent } from "./components/ErrorEvent"
export { EventDisplay, useEventDisplayState } from "./components/EventDisplay"
export type { EventDisplayProps, EventDisplayState } from "./components/EventDisplay"
export { EventList, useEventListState } from "./components/EventList"
export type { EventListProps, EventListState } from "./components/EventList"
export { EventStreamEventItem } from "./components/EventStreamEventItem"
export type { FilterReason } from "./components/EventStreamEventItem"
export { HighlightedLine } from "./components/HighlightedLine"
export { StreamingBlockRenderer } from "./components/StreamingBlockRenderer"
export { StreamingContentRenderer } from "./components/StreamingContentRenderer"
export { ThinkingBlock } from "./components/ThinkingBlock"
export { TodoList } from "./components/TodoList"
export { ToolUseCard } from "./components/ToolUseCard"
export type { ToolUseCardProps } from "./components/ToolUseCard"
export { UserMessage } from "./components/UserMessage"

// Components: Indicators
export { TokenUsageDisplay } from "./components/TokenUsageDisplay"
export type { TokenUsageDisplayProps } from "./components/TokenUsageDisplay"
export { ContextWindowProgress } from "./components/ContextWindowProgress"
export type { ContextWindowProgressProps } from "./components/ContextWindowProgress"

// Components: Shared
export { AutoScroll } from "./components/AutoScroll"
export type { AutoScrollProps } from "./components/AutoScroll"
export { ScrollToBottomButton } from "./components/ScrollToBottomButton"
export type { ScrollToBottomButtonProps } from "./components/ScrollToBottomButton"

// Components: UI
export { CodeBlock } from "./components/CodeBlock"
export type { CodeBlockProps } from "./components/CodeBlock"
export { MarkdownContent } from "./components/MarkdownContent"
export type { MarkdownContentProps } from "./components/MarkdownContent"
export { TextWithLinks } from "./components/TextWithLinks"
export type { TextWithLinksProps } from "./components/TextWithLinks"
export { TopologySpinner } from "./components/TopologySpinner"
export type { TopologySpinnerProps } from "./components/TopologySpinner"

// Context
export { AgentViewContext, DEFAULT_AGENT_VIEW_CONTEXT } from "./context/AgentViewContext"
export { AgentViewProvider } from "./context/AgentViewProvider"
export { useAgentViewContext } from "./context/useAgentViewContext"

// Hooks
export { useAgentChat } from "./hooks/useAgentChat"
export type {
  AgentType,
  ConnectionStatus,
  AgentChatState,
  AgentChatActions,
} from "./hooks/useAgentChat"
export { useAutoScroll } from "./hooks/useAutoScroll"
export type { UseAutoScrollOptions, UseAutoScrollReturn } from "./hooks/useAutoScroll"
export { useHighlightedCode } from "./hooks/useHighlightedCode"
export { useStreamingState } from "./hooks/useStreamingState"
export { useTokenUsage, useContextWindow } from "./hooks/useTokenUsage"

// Lib: Session Index
export {
  listSessions,
  getSession,
  addSession,
  updateSession,
  removeSession,
  clearSessionIndex,
} from "./lib/sessionIndex"
export type { SessionIndexEntry } from "./lib/sessionIndex"

// Lib: Utilities
export { cx, cn, stripAnsi, hasAnsiCodes, stripTaskPrefix, toRelativePath } from "./lib/utils"
export { buildToolResultsMap } from "./lib/buildToolResultsMap"
export type { ToolResult, ToolResultsInfo } from "./lib/buildToolResultsMap"
export { renderEventContentBlock } from "./lib/renderEventContentBlock"
export { extractTokenUsageFromEvent, aggregateTokenUsage } from "./lib/extractTokenUsage"
export { formatTokenCount } from "./lib/formatTokenCount"
export { getLanguageFromFilePath } from "./lib/getLanguageFromFilePath"
export { getOutputSummary } from "./lib/getOutputSummary"
export { getPreviewInfo } from "./lib/getPreviewInfo"
export { getStatusColor } from "./lib/getStatusColor"
export { getToolSummary } from "./lib/getToolSummary"
export { parseDiff } from "./lib/parseDiff"
export { parseTaskLifecycleEvent } from "./lib/parseTaskLifecycleEvent"
export { parsePromiseCompleteEvent } from "./lib/parsePromiseCompleteEvent"
export { unescapeJsonString } from "./lib/unescapeJsonString"

// Lib: Type Guards
export { isAssistantMessage } from "./lib/isAssistantMessage"
export { isErrorEvent } from "./lib/isErrorEvent"
export { isRalphTaskCompletedEvent } from "./lib/isRalphTaskCompletedEvent"
export { isRalphTaskStartedEvent } from "./lib/isRalphTaskStartedEvent"
export { isStreamEvent } from "./lib/isStreamEvent"
export { isSystemEvent } from "./lib/isSystemEvent"
export { isToolUseChatEvent } from "./lib/isToolUseChatEvent"
export { isToolResultEvent } from "./lib/isToolResultEvent"
export { isUserMessageEvent } from "./lib/isUserMessageEvent"

// Lib: Event Filter Pipeline
export {
  shouldFilterEventByType,
  shouldFilterContentBlock,
  hasRenderableContent,
  logEventFilterDecision,
  logContentBlockFilterDecision,
  isFilterDebugEnabled,
  getFilterStats,
  debugFilterPipeline,
} from "./lib/EventFilterPipeline"
export type { FilterResult, FilterContext } from "./lib/EventFilterPipeline"

// Adapter
export { createBatchConverter } from "./adapter"
export type { AgentAdapter, AgentMeta, ConvertEvent, ConvertEvents } from "./adapter"

// Constants
export { TOOL_OUTPUT_PREVIEW_LINES } from "./constants"

// Canonical Event Schema
export {
  // Schema objects
  BaseEvent as BaseEventSchema,
  CanonicalEvent as CanonicalEventSchema,
  MessageEvent as MessageEventSchema,
  ThinkingEvent as ThinkingEventSchema,
  ToolUseEvent as ToolUseEventSchema,
  ToolResultEvent as ToolResultEventSchema,
  ResultEvent as ResultEventSchema,
  ErrorEvent as ErrorEventSchema,
  StatusEvent as StatusEventSchema,
  UnknownEvent as UnknownEventSchema,
  // Type guards (canonical)
  isCoreEvent,
  isMessageEvent as isCanonicalMessageEvent,
  isThinkingEvent as isCanonicalThinkingEvent,
  isToolUseEvent as isCanonicalToolUseEvent,
  isToolResultEvent as isCanonicalToolResultEvent,
  isResultEvent as isCanonicalResultEvent,
  isErrorEvent as isCanonicalErrorEvent,
  isStatusEvent as isCanonicalStatusEvent,
} from "./events/index.js"
export type {
  // Inferred types
  BaseEventType,
  CanonicalEventType,
  CanonicalEventEncoded,
  MessageEventType,
  ThinkingEventType,
  ToolUseEventType,
  ToolResultEventType,
  ResultEventType,
  ErrorEventType,
  StatusEventType,
  UnknownEventType,
  AgentStatus,
} from "./events/index.js"

// Types
export type {
  // Base types
  ChatEvent,
  // Discriminated event types
  UserMessageChatEvent,
  UserChatEvent,
  AssistantChatEvent,
  StreamChatEvent,
  StreamEventPayload,
  ResultChatEvent,
  ErrorChatEvent,
  ToolUseChatEvent,
  RalphTaskStartedChatEvent,
  RalphTaskCompletedChatEvent,
  RalphSessionStartChatEvent,
  RalphSessionEndChatEvent,
  SystemChatEvent,
  AssistantTextChatEvent,
  TaskLifecycleChatEvent,
  PromiseCompleteChatEvent,
  // Content block types
  AssistantTextContentBlock,
  AssistantThinkingContentBlock,
  AssistantToolUseContentBlock,
  AssistantContentBlock,
  StreamingTextBlock,
  StreamingThinkingBlock,
  StreamingToolUseBlock,
  StreamingContentBlock,
  StreamingMessage,
  // Other types
  TokenUsage,
  ContextWindow,
  DiffLine,
  ToolName,
  AgentViewLinkHandlers,
  AgentViewToolOutputControl,
  AgentViewContextValue,
  AgentViewTask,
  CustomEventRenderer,
  // Deprecated aliases
  AssistantTextEvent,
  UserMessageEvent,
  TaskLifecycleEventData,
  ErrorEventData,
  ToolUseEvent,
} from "./types"
