// ---- Components: Events ----
export { AnsiOutput } from "./components/events/AnsiOutput"
export { AssistantText } from "./components/events/AssistantText"
export { DiffView } from "./components/events/DiffView"
export { ErrorEvent } from "./components/events/ErrorEvent"
export { EventDisplay, useEventDisplayState } from "./components/events/EventDisplay"
export type { EventDisplayProps, EventDisplayState } from "./components/events/EventDisplay"
export { EventList, useEventListState } from "./components/events/EventList"
export type { EventListProps, EventListState } from "./components/events/EventList"
export { EventStreamEventItem } from "./components/events/EventStreamEventItem"
export type { FilterReason } from "./components/events/EventStreamEventItem"
export { HighlightedLine } from "./components/events/HighlightedLine"
export { PromiseCompleteEvent } from "./components/events/PromiseCompleteEvent"
export { StreamingBlockRenderer } from "./components/events/StreamingBlockRenderer"
export { StreamingContentRenderer } from "./components/events/StreamingContentRenderer"
export { TaskLifecycleEvent } from "./components/events/TaskLifecycleEvent"
export { ThinkingBlock } from "./components/events/ThinkingBlock"
export { TodoList } from "./components/events/TodoList"
export { ToolUseCard } from "./components/events/ToolUseCard"
export type { ToolUseCardProps } from "./components/events/ToolUseCard"
export { UserMessage } from "./components/events/UserMessage"

// ---- Components: Shared ----
export { ContentStreamContainer } from "./components/shared/ContentStreamContainer"
export type { ContentStreamContainerProps } from "./components/shared/ContentStreamContainer"
export { ScrollToBottomButton } from "./components/shared/ScrollToBottomButton"
export type { ScrollToBottomButtonProps } from "./components/shared/ScrollToBottomButton"

// ---- Components: UI ----
export { CodeBlock } from "./components/ui/code-block"
export type { CodeBlockProps } from "./components/ui/code-block"
export { MarkdownContent } from "./components/ui/MarkdownContent"
export type { MarkdownContentProps } from "./components/ui/MarkdownContent"
export { TextWithLinks } from "./components/ui/TextWithLinks"
export type { TextWithLinksProps } from "./components/ui/TextWithLinks"
export { TopologySpinner } from "./components/ui/TopologySpinner"
export type { TopologySpinnerProps } from "./components/ui/TopologySpinner"

// ---- Context ----
export { AgentViewContext, DEFAULT_AGENT_VIEW_CONTEXT } from "./context/AgentViewContext"
export { AgentViewProvider } from "./context/AgentViewProvider"
export { useAgentViewContext } from "./context/useAgentViewContext"

// ---- Hooks ----
export { useAutoScroll } from "./hooks/useAutoScroll"
export type { UseAutoScrollOptions, UseAutoScrollReturn } from "./hooks/useAutoScroll"
export { useHighlightedCode } from "./hooks/useHighlightedCode"
export { useStreamingState } from "./hooks/useStreamingState"

// ---- Lib: Utilities ----
export { cx, cn, stripAnsi, hasAnsiCodes, stripTaskPrefix, toRelativePath } from "./lib/utils"
export { buildToolResultsMap } from "./lib/buildToolResultsMap"
export type { ToolResult, ToolResultsInfo } from "./lib/buildToolResultsMap"
export { renderEventContentBlock } from "./lib/renderEventContentBlock"
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

// ---- Lib: Type Guards ----
export { isAssistantMessage } from "./lib/isAssistantMessage"
export { isErrorEvent } from "./lib/isErrorEvent"
export { isRalphTaskCompletedEvent } from "./lib/isRalphTaskCompletedEvent"
export { isRalphTaskStartedEvent } from "./lib/isRalphTaskStartedEvent"
export { isStreamEvent } from "./lib/isStreamEvent"
export { isSystemEvent } from "./lib/isSystemEvent"
export { isToolResultEvent } from "./lib/isToolResultEvent"
export { isUserMessageEvent } from "./lib/isUserMessageEvent"

// ---- Lib: Event Filter Pipeline ----
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

// ---- Adapter ----
export { createBatchConverter } from "./adapter"
export type { AgentAdapter, AgentMeta, ConvertEvent, ConvertEvents } from "./adapter"

// ---- Constants ----
export { TOOL_OUTPUT_PREVIEW_LINES } from "./constants"

// ---- Types ----
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
  // Deprecated aliases
  AssistantTextEvent,
  UserMessageEvent,
  TaskLifecycleEventData,
  ErrorEventData,
  ToolUseEvent,
} from "./types"
