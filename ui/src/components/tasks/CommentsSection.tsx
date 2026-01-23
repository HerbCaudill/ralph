import { useState, useEffect, useCallback } from "react"
import { IconLoader2 } from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { MarkdownEditor } from "@/components/ui/MarkdownEditor"
import { CommentItem } from "./CommentItem"
import type { Comment } from "@/types"

export function CommentsSection({ taskId, readOnly = false, className }: CommentsSectionProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newComment, setNewComment] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

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
  }, [taskId, newComment, isSubmitting, fetchComments])

  const handleSubmit = useCallback(() => {
    if (newComment.trim() && !isSubmitting) {
      handleAddComment()
    }
  }, [handleAddComment, newComment, isSubmitting])

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
        <div className="mt-2 space-y-2">
          <MarkdownEditor
            value={newComment}
            onChange={setNewComment}
            onSubmit={handleSubmit}
            placeholder="Add a comment (Enter to submit, Shift+Enter for new line)..."
            showToolbar={false}
            size="sm"
            className={isSubmitting ? "pointer-events-none opacity-50" : ""}
          />
          <div className="flex justify-end">
            <Button
              onClick={handleAddComment}
              disabled={!newComment.trim() || isSubmitting}
              className="min-w-[80px]"
              aria-label="Add comment"
            >
              {isSubmitting ?
                <IconLoader2 className="h-4 w-4 animate-spin" />
              : "Add"}
            </Button>
          </div>
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
