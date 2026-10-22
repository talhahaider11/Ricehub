export default function PostActions({
  liked,
  reactionCount,
  commentCount,
  onReaction,
  onComments,
}) {
  return (
    <div className="post-actions">
      <button
        className={
          liked
            ? "action liked"
            : "action"
        }
        onClick={onReaction}
      >
        {liked ? "♥" : "♡"}{" "}
        {reactionCount}
      </button>

      <button
        className="action"
        onClick={onComments}
      >
        💬 {commentCount}
      </button>

      <button className="action">
        ↗ Share
      </button>
    </div>
  );
}