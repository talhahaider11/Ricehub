import { useState } from "react";
import postService from "../../services/postService";

export default function CommentBox({ postId, onCreated }) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    if (!content.trim()) return;

    try {
      setLoading(true);
      setError("");
      const comment = await postService.createComment(postId, content.trim());
      setContent("");
      onCreated?.(comment);
    } catch (commentError) {
      setError(
        commentError.response?.data?.content?.[0] ||
          commentError.response?.data?.detail ||
          "Comment could not be sent."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="comment-box" onSubmit={submit}>
      <div className="comment-input-wrap">
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Write a comment..."
          maxLength={2000}
          rows={2}
          aria-label="Comment content"
        />
        <span className={content.length > 1800 ? "text-danger" : "text-muted"}>
          {content.length}/2000
        </span>
      </div>

      <button type="submit" disabled={!content.trim() || loading}>
        {loading ? "..." : "Send"}
      </button>
      {error && <span className="error" role="alert">{error}</span>}
    </form>
  );
}