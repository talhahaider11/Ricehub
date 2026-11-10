import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  MessageCircle,
  Share2,
  SmilePlus,
  ThumbsUp,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import Avatar from "../common/Avatar";
import CommentBox from "./CommentBox";
import CommentList from "./CommentList";
import postService from "../../services/postService";
import PostMenu from "./PostMenu";
import ImageLightbox from "../common/ImageLightbox";
import PostContent from "./PostContent";
import { getMediaUrl } from "../../utils/constants";
import ReportContentButton from "../common/ReportContentButton";
import MediaGrid from "../media/MediaGrid";
import VerifiedBadge from "../common/VerifiedBadge";
import { useLanguage } from "../../context/LanguageContext";

const reactions = [
  { type: "like", labelKey: "reactionLike", emoji: "👍" },
  { type: "love", labelKey: "reactionLove", emoji: "❤️" },
  { type: "care", labelKey: "reactionCare", emoji: "🥰" },
  { type: "haha", labelKey: "reactionHaha", emoji: "😂" },
  { type: "wow", labelKey: "reactionWow", emoji: "😮" },
];

export default function PostCard({
  post,
  currentUser,
  trackView = false,
  onDeleted,
  onUpdated,
}) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const prefersReducedMotion = useReducedMotion();
  const [reactionType, setReactionType] = useState(post.my_reaction || null);
  const [reactionCount, setReactionCount] = useState(post.reactions_count || 0);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [reactionSaving, setReactionSaving] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentsCount, setCommentsCount] = useState(post.comments_count || 0);
  const [commentRefreshKey, setCommentRefreshKey] = useState(0);
  const [imageOpen, setImageOpen] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const longPressTimer = useRef(null);
  const longPressTriggered = useRef(false);
  const articleRef = useRef(null);

  useEffect(() => {
    if (
      !trackView
      || !articleRef.current
      || !("IntersectionObserver" in window)
    ) {
      return undefined;
    }

    let recorded = false;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!recorded && entry.isIntersecting) {
          recorded = true;
          observer.disconnect();
          postService.trackFeedView(post.id).catch((error) => {
            console.error("Could not record feed post view.", error);
          });
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(articleRef.current);
    return () => observer.disconnect();
  }, [post.id, trackView]);

  const startReactionLongPress = (event) => {
    if (event.pointerType !== "touch") return;
    longPressTriggered.current = false;
    longPressTimer.current = window.setTimeout(() => {
      longPressTriggered.current = true;
      setShowReactionPicker(true);
    }, 500);
  };

  const endReactionLongPress = () => {
    window.clearTimeout(longPressTimer.current);
  };

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
        error.response?.data?.detail || t("reactionCouldNotSave")
      );
    } finally {
      setShowReactionPicker(false);
      setReactionSaving(false);
    }
  };

  const sharePost = async () => {
    setActionError("");
    setActionMessage("");
    const shareUrl = `${window.location.origin}/posts/${post.id}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: t("riceHubPost"),
          text: post.content?.slice(0, 120) || t("viewPostOnRiceHub"),
          url: shareUrl,
        });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        setActionMessage(t("postLinkCopied"));
      } else {
        setActionError(t("sharingUnsupported"));
      }
    } catch (error) {
      if (error.name !== "AbortError") {
        setActionError(t("postLinkShareFailed"));
      }
    }
  };

  const selectedReaction = reactions.find(
    (reaction) => reaction.type === reactionType
  );

  return (
    <motion.article
      ref={articleRef}
      className="card post-card"
      id={`post-${post.id}`}
      variants={{
        hidden: { opacity: 0, y: prefersReducedMotion ? 0 : 14 },
        visible: { opacity: 1, y: 0 },
      }}
      transition={{ duration: prefersReducedMotion ? 0.01 : 0.3, ease: "easeOut" }}
    >
      <div className="post-header">
        <div className="post-author">
          <Link
            className="post-author-link"
            to={`/profile/${post.author?.id}`}
            aria-label={t("viewProfileOf", {
              username: post.author?.username || t("user"),
            })}
          >
            <Avatar user={post.author} />
            <span>
              <strong>
                {post.author?.first_name || post.author?.username}
              </strong>
              <VerifiedBadge verified={post.author?.is_verified} />
              <small>@{post.author?.username}</small>
            </span>
          </Link>
        </div>

        <PostMenu
          post={post}
          currentUser={currentUser}
          onDeleted={onDeleted}
          onUpdated={onUpdated}
        />
      </div>

      {post.post_type === "reel" && (
        <span className="post-type-label">{t("reel")}</span>
      )}
      {post.content && <PostContent content={post.content} />}

      {post.image && (
        <>
          <img
            className="post-image clickable-image"
            src={getMediaUrl(post.image)}
            alt={t("postAttachment")}
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
          {t("videoPlaybackUnsupported")}
        </video>
      )}
      {post.media_assets?.length > 0 && (
        <MediaGrid media={post.media_assets} />
      )}

      <div className="post-stats">
        <span>
          {selectedReaction && (
            <span aria-label={`${t("yourReaction")}: ${t(selectedReaction.labelKey)}`}>
              {selectedReaction.emoji}{" "}
            </span>
          )}
          {t("reactionCount", { count: reactionCount })}
        </span>
        <span>{t("commentCount", { count: commentsCount })}</span>
      </div>

      <div className="post-actions">
        <div
          className="post-reaction-control"
          onMouseEnter={() => setShowReactionPicker(true)}
          onMouseLeave={() => setShowReactionPicker(false)}
        >
          <button
            className={reactionType ? "post-action active" : "post-action"}
            onPointerDown={startReactionLongPress}
            onPointerUp={endReactionLongPress}
            onPointerCancel={endReactionLongPress}
            onPointerLeave={endReactionLongPress}
            onClick={() => {
              if (longPressTriggered.current) {
                longPressTriggered.current = false;
                return;
              }
              chooseReaction(reactionType || "like");
            }}
            disabled={reactionSaving}
            aria-label={reactionType
              ? t("removeReaction", {
                reaction: selectedReaction ? t(selectedReaction.labelKey) : "",
              })
              : t("likePost")}
          >
            {selectedReaction ? (
              <span aria-hidden="true">{selectedReaction.emoji}</span>
            ) : (
              <ThumbsUp size={18} />
            )}
            {selectedReaction ? t(selectedReaction.labelKey) : t("reactionLike")}
          </button>
          <button
            className="post-action reaction-picker-trigger"
            onClick={() => setShowReactionPicker((shown) => !shown)}
            disabled={reactionSaving}
            aria-expanded={showReactionPicker}
            aria-label={t("chooseReaction")}
          >
            <SmilePlus size={18} aria-hidden="true" />
          </button>
          <AnimatePresence>
            {showReactionPicker && (
              <motion.div
                className="reaction-picker"
                role="group"
                aria-label={t("reactions")}
                initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 6, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: prefersReducedMotion ? 0.01 : 0.16 }}
              >
                {reactions.map((reaction) => (
                  <motion.button
                    key={reaction.type}
                    type="button"
                    onClick={() => chooseReaction(reaction.type)}
                    disabled={reactionSaving}
                    aria-label={t(reaction.labelKey)}
                    title={t(reaction.labelKey)}
                    aria-pressed={reactionType === reaction.type}
                    whileHover={prefersReducedMotion ? undefined : { scale: 1.15, y: -3 }}
                    whileTap={prefersReducedMotion ? undefined : { scale: 0.92 }}
                  >
                    {reaction.emoji}
                  </motion.button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <button
          className="post-action"
          onClick={() => setShowComments((value) => !value)}
        >
          <MessageCircle size={18} />
          {t("comment")}
        </button>
        <button className="post-action" onClick={sharePost}>
          <Share2 size={18} />
          {t("share")}
        </button>
        {currentUser?.id
          && String(post.author?.id) === String(currentUser.id) && (
          <button
            className="post-action"
            type="button"
            onClick={() => navigate(`/billing?postId=${post.id}`)}
          >
            {t("boostPost")}
          </button>
        )}
        {String(post.author?.id) !== String(currentUser?.id) && (
          <ReportContentButton targetType="post" targetId={post.id} />
        )}
      </div>
      {actionError && <p className="settings-error" role="alert">{actionError}</p>}
      {actionMessage && <p className="settings-status" role="status">{actionMessage}</p>}

      {showComments && (
        <>
          <CommentBox
            postId={post.id}
            onCreated={() => {
              setCommentsCount((count) => count + 1);
              setCommentRefreshKey((key) => key + 1);
            }}
          />
          <CommentList
            postId={post.id}
            currentUser={currentUser}
            refreshKey={commentRefreshKey}
          />
        </>
      )}
    </motion.article>
  );
}