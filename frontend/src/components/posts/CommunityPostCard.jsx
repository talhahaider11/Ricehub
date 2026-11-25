import { useState } from "react";
import { Heart, MessageCircle } from "lucide-react";
import Avatar from "../common/Avatar";
import { getMediaUrl } from "../../utils/constants";
import { getArrayResults } from "../../utils/arrayResults";
import { useLanguage } from "../../context/LanguageContext";
import communityService from "../../services/communityService";

export default function CommunityPostCard({
  post,
  canManage,
  onDeleted,
  onUpdated,
}) {
  const { t } = useLanguage();
  const [isLiked, setIsLiked] = useState(Boolean(post.is_liked));
  const [likesCount, setLikesCount] = useState(post.likes_count || 0);
  const [comments, setComments] = useState([]);
  const [commentsCount, setCommentsCount] = useState(post.comments_count || 0);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const toggleLike = async () => {
    setSaving(true);
    setError("");
    try {
      const result = await communityService.toggleCommunityPostLike(post.id);
      setIsLiked(result.is_liked);
      setLikesCount(result.likes_count);
      onUpdated?.(post.id, result);
    } catch (likeError) {
      console.error("Page post like could not be updated:", likeError);
      setError(likeError.response?.data?.detail || t("communityPostActionFailed"));
    } finally {
      setSaving(false);
    }
  };

  const toggleComments = async () => {
    const shouldShow = !showComments;
    setShowComments(shouldShow);
    if (!shouldShow || comments.length) return;
    setSaving(true);
    setError("");
    try {
      const result = await communityService.communityPostComments(post.id);
      setComments(getArrayResults(result, "Page post comments"));
    } catch (loadError) {
      console.error("Page post comments could not be loaded:", loadError);
      setError(loadError.response?.data?.detail || t("communityPostActionFailed"));
    } finally {
      setSaving(false);
    }
  };

  const submitComment = async (event) => {
    event.preventDefault();
    const content = commentText.trim();
    if (!content || saving) return;
    setSaving(true);
    setError("");
    try {
      const comment = await communityService.createCommunityPostComment(
        post.id,
        content
      );
      setComments((current) => [...current, comment]);
      setCommentsCount((count) => count + 1);
      setCommentText("");
      onUpdated?.(post.id, { comments_count: commentsCount + 1 });
    } catch (createError) {
      console.error("Page post comment could not be created:", createError);
      setError(createError.response?.data?.detail || t("communityPostActionFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <article className="social-card community-post-card">
      <div className="post-author">
        <Avatar user={post.author} size="small" />
        <strong>@{post.author?.username}</strong>
      </div>
      {post.content && <p>{post.content}</p>}
      {post.image && (
        <img src={getMediaUrl(post.image)} alt={t("postAttachment")} />
      )}
      <div className="social-actions">
        <button
          type="button"
          className={`btn ${isLiked ? "btn-primary" : "btn-secondary"}`}
          onClick={toggleLike}
          disabled={saving}
          aria-pressed={isLiked}
        >
          <Heart size={16} aria-hidden="true" />
          {isLiked ? t("communityUnlike") : t("reactionLike")} ({likesCount})
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={toggleComments}
          aria-expanded={showComments}
          aria-controls={`community-post-comments-${post.id}`}
        >
          <MessageCircle size={16} aria-hidden="true" />
          {t("comment")} ({commentsCount})
        </button>
        {canManage && (
          <button
            type="button"
            className="btn btn-secondary"
            disabled={saving}
            onClick={() => onDeleted?.(post.id)}
          >
            {t("removePost")}
          </button>
        )}
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {showComments && (
        <section
          className="comment-panel"
          id={`community-post-comments-${post.id}`}
          aria-label="Community post comments"
        >
          <div className="comment-panel-heading">
            <h3>Comments</h3>
            <span>{commentsCount}</span>
          </div>
          <div className="comment-list">
            {comments.map((comment) => (
              <div className="comment" key={comment.id}>
                <Avatar user={comment.author} size="small" />
                <div className="comment-body">
                  <strong>@{comment.author?.username}</strong>
                  <p>{comment.content}</p>
                </div>
              </div>
            ))}
            {!comments.length && (
              <p className="social-empty">{t("noCommunityComments")}</p>
            )}
          </div>
          <form className="comment-box comment-composer" onSubmit={submitComment}>
            <textarea
              className="comment-textarea"
              value={commentText}
              onChange={(event) => setCommentText(event.target.value)}
              placeholder={t("writeCommunityComment")}
              maxLength={2000}
              rows={2}
              aria-label={t("writeCommunityComment")}
            />
            <button type="submit" disabled={!commentText.trim() || saving}>
              {t("send")}
            </button>
          </form>
        </section>
      )}
    </article>
  );
}
