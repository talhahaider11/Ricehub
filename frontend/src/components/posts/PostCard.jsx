import { useState } from "react";
import {
  MessageCircle,
  Share2,
  SmilePlus,
  ThumbsUp,
} from "lucide-react";

import Avatar from "../common/Avatar";
import CommentBox from "./CommentBox";
import CommentList from "./CommentList";
import postService from "../../services/postService";
import PostMenu from "./PostMenu";
import ImageLightbox from "../common/ImageLightbox";
import PostContent from "./PostContent";
import { getMediaUrl } from "../../utils/constants";

const reactions = [
  { type: "like", label: "Like", emoji: "👍" },
  { type: "love", label: "Love", emoji: "❤️" },
  { type: "haha", label: "Haha", emoji: "😂" },
  { type: "wow", label: "Wow", emoji: "😮" },
  { type: "sad", label: "Sad", emoji: "😢" },
  { type: "angry", label: "Angry", emoji: "😡" },
];

export default function PostCard({
  post,
  currentUser,
  onDeleted,
  onUpdated,
}) {
  const [reactionType, setReactionType] = useState(post.my_reaction || null);
  const [reactionCount, setReactionCount] = useState(post.reactions_count || 0);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [reactionSaving, setReactionSaving] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");

  const chooseReaction = async (nextReaction) => {
    setActionError("");
    setActionMessage("");
    setReactionSaving(true);
    try {
      if (reactionType === nextReaction) {
        await postService.unreact(post.id);
        setReactionType(null);
        setReactionCount((count) => Math.max(0, count - 1));
      } else {
        await postService.react(post.id, nextReaction);
        if (!reactionType) {
          setReactionCount((count) => count + 1);
        }
        setReactionType(nextReaction);
      }
    } catch (error) {
      setActionError(
        error.response?.data?.detail || "Your reaction could not be saved."
      );
    } finally {
      setShowReactionPicker(false);
      setReactionSaving(false);
    }
  };

  const sharePost = async () => {
    setActionError("");
    setActionMessage("");
    const shareUrl = `${window.location.origin}/#post-${post.id}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: "RiceHub post",
          text: post.content?.slice(0, 120) || "View this post on RiceHub",
          url: shareUrl,
        });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        setActionMessage("Post link copied.");
      } else {
        setActionError("Sharing is not supported by this browser.");
      }
    } catch (error) {
      if (error.name !== "AbortError") {
        setActionError("The post link could not be shared.");
      }
    }
  };

  const selectedReaction = reactions.find(
    (reaction) => reaction.type === reactionType
  );

  return (
    <article className="card post-card" id={`post-${post.id}`}>
      <div className="post-header">
        <div className="post-author">
          <Avatar user={post.author} />
          <div>
            <strong>
              {post.author?.first_name || post.author?.username}
            </strong>
            <small>@{post.author?.username}</small>
          </div>
        </div>

        <PostMenu
          post={post}
          currentUser={currentUser}
          onDeleted={onDeleted}
          onUpdated={onUpdated}
        />
      </div>

      {post.content && <PostContent content={post.content} />}

      {post.image && (
        <>
          <img
            className="post-image clickable-image"
            src={getMediaUrl(post.image)}
            alt="Post attachment"
            onClick={() => setImageOpen(true)}
          />

          <ImageLightbox
            src={getMediaUrl(post.image)}
            open={imageOpen}
            onClose={() => setImageOpen(false)}
          />
        </>
      )}
      {post.video && (
        <video
          className="post-video"
          src={getMediaUrl(post.video)}
          controls
          playsInline
          preload="metadata"
        >
          Your browser does not support video playback.
        </video>
      )}

      <div className="post-stats">
        <span>
          {selectedReaction && (
            <span aria-label={`Your reaction: ${selectedReaction.label}`}>
              {selectedReaction.emoji}{" "}
            </span>
          )}
          {reactionCount} reactions
        </span>
        <span>{post.comments_count || 0} comments</span>
      </div>

      <div className="post-actions">
        <div className="post-reaction-control">
          <button
            className={reactionType ? "post-action active" : "post-action"}
            onClick={() => chooseReaction(reactionType || "like")}
            disabled={reactionSaving}
            aria-label={reactionType ? `Remove ${selectedReaction?.label} reaction` : "Like post"}
          >
            {selectedReaction ? (
              <span aria-hidden="true">{selectedReaction.emoji}</span>
            ) : (
              <ThumbsUp size={18} />
            )}
            {selectedReaction?.label || "Like"}
          </button>
          <button
            className="post-action reaction-picker-trigger"
            onClick={() => setShowReactionPicker((shown) => !shown)}
            disabled={reactionSaving}
            aria-expanded={showReactionPicker}
            aria-label="Choose a reaction"
          >
            <SmilePlus size={18} aria-hidden="true" />
          </button>
          {showReactionPicker && (
            <div className="reaction-picker" role="group" aria-label="Reactions">
              {reactions.map((reaction) => (
                <button
                  key={reaction.type}
                  type="button"
                  onClick={() => chooseReaction(reaction.type)}
                  disabled={reactionSaving}
                  aria-label={reaction.label}
                  title={reaction.label}
                  aria-pressed={reactionType === reaction.type}
                >
                  {reaction.emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          className="post-action"
          onClick={() => setShowComments((value) => !value)}
        >
          <MessageCircle size={18} />
          Comment
        </button>
        <button className="post-action" onClick={sharePost}>
          <Share2 size={18} />
          Share
        </button>
      </div>
      {actionError && <p className="settings-error" role="alert">{actionError}</p>}
      {actionMessage && <p className="settings-status" role="status">{actionMessage}</p>}

      {showComments && (
        <>
          <CommentBox postId={post.id} />
          <CommentList postId={post.id} currentUser={currentUser} />
        </>
      )}
    </article>
  );
}