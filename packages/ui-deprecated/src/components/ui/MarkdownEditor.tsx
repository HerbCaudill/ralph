import { useRef, useCallback, useEffect } from "react"
import {
  MDXEditor,
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  thematicBreakPlugin,
  markdownShortcutPlugin,
  linkPlugin,
  linkDialogPlugin,
  codeBlockPlugin,
  toolbarPlugin,
  BoldItalicUnderlineToggles,
  ListsToggle,
  BlockTypeSelect,
  CreateLink,
  type MDXEditorMethods,
} from "@mdxeditor/editor"
import "@mdxeditor/editor/style.css"
import { cn } from "@/lib/utils"
import { useTheme } from "@/hooks/useTheme"

export interface MarkdownEditorProps {
  /** The initial markdown content */
  value: string
  /** Callback when the markdown content changes */
  onChange?: (markdown: string) => void
  /** Callback when the editor loses focus */
  onBlur?: () => void
  /** Callback when Enter is pressed (without Shift) - for submitting comments, etc. */
  onSubmit?: () => void
  /** Placeholder text when the editor is empty */
  placeholder?: string
  /** Whether the editor is read-only */
  readOnly?: boolean
  /** Whether to show the toolbar (default: true) */
  showToolbar?: boolean
  /** Additional class name for the editor container */
  className?: string
  /** Whether to auto-focus the editor on mount */
  autoFocus?: boolean
  /** Size variant for the editor (default: "sm") */
  size?: "sm" | "base"
}

/**
 * A reusable markdown editor component built on MDXEditor.
 * Supports common markdown features like headings, lists, links, and formatting.
 */
export function MarkdownEditor({
  value,
  onChange,
  onBlur,
  onSubmit,
  placeholder = "Write your markdown here...",
  readOnly = false,
  showToolbar = true,
  className,
  autoFocus = false,
  size = "sm",
}: MarkdownEditorProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"
  const editorRef = useRef<MDXEditorMethods>(null)

  // Handle external value changes by updating the editor
  const lastExternalValue = useRef(value)
  useEffect(() => {
    if (value !== lastExternalValue.current && editorRef.current) {
      editorRef.current.setMarkdown(value)
      lastExternalValue.current = value
    }
  }, [value])

  const handleChange = useCallback(
    (markdown: string) => {
      lastExternalValue.current = markdown
      onChange?.(markdown)
    },
    [onChange],
  )

  const handleBlur = useCallback(() => {
    onBlur?.()
  }, [onBlur])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Enter without Shift triggers submit
      if (onSubmit && e.key === "Enter" && !e.shiftKey) {
        // Allow Enter in lists and other block elements
        const selection = window.getSelection()
        if (selection?.anchorNode) {
          const listItem = selection.anchorNode.parentElement?.closest("li")
          if (listItem) return // Allow normal Enter in lists
        }
        e.preventDefault()
        onSubmit()
      }
    },
    [onSubmit],
  )

  // Build plugins array based on props
  const plugins = [
    headingsPlugin(),
    listsPlugin(),
    quotePlugin(),
    thematicBreakPlugin(),
    markdownShortcutPlugin(),
    linkPlugin(),
    linkDialogPlugin(),
    codeBlockPlugin({ defaultCodeBlockLanguage: "text" }),
    ...(showToolbar && !readOnly ?
      [
        toolbarPlugin({
          toolbarContents: () => (
            <div className="flex flex-wrap items-center gap-1">
              <BlockTypeSelect />
              <BoldItalicUnderlineToggles />
              <ListsToggle />
              <CreateLink />
            </div>
          ),
        }),
      ]
    : []),
  ]

  return (
    <div
      className={cn(
        "markdown-editor",
        isDark && "dark-theme",
        size === "sm" && "markdown-editor-sm",
        className,
      )}
      onKeyDown={onSubmit ? handleKeyDown : undefined}
    >
      <MDXEditor
        ref={editorRef}
        markdown={value}
        onChange={handleChange}
        onBlur={handleBlur}
        plugins={plugins}
        placeholder={placeholder}
        readOnly={readOnly}
        autoFocus={autoFocus}
        contentEditableClassName={cn(
          "prose dark:prose-invert max-w-none min-h-25",
          size === "sm" ? "prose-sm" : "prose-base",
          "prose-p:my-1 prose-p:leading-snug",
          "prose-strong:font-medium",
          "prose-a:text-cyan-600 dark:prose-a:text-cyan-400 prose-a:no-underline hover:prose-a:underline",
          "prose-code:text-muted-foreground prose-code:text-xs prose-code:font-normal prose-code:font-mono",
          "prose-code:before:content-none prose-code:after:content-none",
          "prose-blockquote:not-italic",
          "prose-ul:my-1 prose-ol:my-1 prose-li:my-0",
          "focus:outline-none",
        )}
      />
    </div>
  )
}
