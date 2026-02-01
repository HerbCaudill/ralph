import { useState, useEffect, useCallback, useRef, type KeyboardEvent } from "react"
import { IconArrowUp, IconLoader2 } from "@tabler/icons-react"
import { cn } from "../../lib/cn"
import { Label } from "../ui/label"
import { InputGroup, InputGroupAddon, InputGroupButton } from "../ui/input-group"
import { CommentItem } from "./CommentItem"
import { useBeadsViewStore, selectCommentDraft } from "../../store"
import type { Comment } from "../../types"

export function CommentsSection({ taskId, readOnly = false, className }: CommentsSectionProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Use store for draft persistence per task
  const newComment = useBeadsViewStore(state => selectCommentDraft(state, taskId))
  const setCommentDraft = useBeadsViewStore(state => state.setCommentDraft)

  const setNewComment = useCallback(
    (value: string) => {
      setCommentDraft(taskId, value)
    },
    [setCommentDraft, taskId],
  )

  const fetchComments = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const response = await fetch(`/api/tasks/${taskId}/comments`)

      const contentType = response.headers.get("content-type")
      if (!response.ok || !contentType?.includes("application/json")) {
        setError(`Server error: ${response.status} ${response.statusText}`)
        return
      }

      const data = (await response.json()) as { ok: boolean; comments?: Comment[]; error?: string }

      if (data.ok && data.comments) {
        setComments(data.comments)
      } else {
        setError(data.error || "Failed to fetch comments")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch comments")
    } finally {
      setIsLoading(false)
    }
  }, [taskId])

  useEffect(() => {
    fetchComments()
  }, [fetchComments])

  const handleAddComment = useCallback(async () => {
    if (!newComment.trim() || isSubmitting) return

    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/tasks/${taskId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment: newComment.trim() }),
      })

      const contentType = response.headers.get("content-type")
      if (!response.ok || !contentType?.includes("application/json")) {
        setError(`Server error: ${response.status} ${response.statusText}`)
        return
      }

      const data = (await response.json()) as { ok: boolean; error?: string }
      if (data.ok) {
        setNewComment("")
        await fetchComments()
      } else {
        setError(data.error || "Failed to add comment")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add comment")
    } finally {
      setIsSubmitting(false)
    }
  }, [taskId, newComment, isSubmitting, fetchComments, setNewComment])

  const handleSubmit = useCallback(() => {
    if (newComment.trim() && !isSubmitting) {
      handleAddComment()
    }
  }, [handleAddComment, newComment, isSubmitting])

  /**
   * Adjusts textarea height to fit content automatically.
   */
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    textarea.style.height = "auto"
    textarea.style.height = `${textarea.scrollHeight}px`
  }, [])

  /**
   * Adjusts textarea height whenever the comment text changes.
   */
  useEffect(() => {
    adjustTextareaHeight()
  }, [newComment, adjustTextareaHeight])

  /**
   * Handles Enter key to submit the comment (Shift+Enter creates new line).
   */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit],
  )

  return (
    <div className={cn("grid gap-2", className)}>
      <Label>Comments</Label>

      {isLoading && (
        <div className="text-muted-foreground flex items-center gap-2 py-2 text-sm">
          <IconLoader2 className="h-4 w-4 animate-spin" />
          Loading comments...
        </div>
      )}

      {error && !isLoading && <div className="text-destructive py-2 text-sm">{error}</div>}

      {!isLoading && !error && comments.length > 0 && (
        <div className="space-y-3">
          {comments.map(comment => (
            <CommentItem key={comment.id} comment={comment} />
          ))}
        </div>
      )}

      {!readOnly && (
        <div className="mt-2">
          <InputGroup data-disabled={isSubmitting}>
            <textarea
              ref={textareaRef}
              data-slot="input-group-control"
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Add a comment (Enter to submit, Shift+Enter for new line)..."
              disabled={isSubmitting}
              aria-label="Add comment"
              rows={1}
              className={cn(
                "placeholder:text-muted-foreground flex-1 bg-transparent",
                "w-full resize-none border-0 px-3 py-2 text-sm",
                "focus:ring-0 focus:outline-none",
                "disabled:cursor-not-allowed disabled:opacity-50",
                "overflow-hidden",
              )}
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                type="button"
                onClick={handleAddComment}
                disabled={!newComment.trim() || isSubmitting}
                size="icon-xs"
                className="rounded-md"
                aria-label="Add comment"
              >
                {isSubmitting ?
                  <IconLoader2 className="size-4 animate-spin" />
                : <IconArrowUp className="size-4" />}
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </div>
      )}
    </div>
  )
}

type CommentsSectionProps = {
  taskId: string
  readOnly?: boolean
  className?: string
}
