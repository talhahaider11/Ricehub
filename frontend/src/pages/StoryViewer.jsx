import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Eye,
  Heart,
  Pause,
  Play,
  Send,
  Trash2,
} from "lucide-react";
import Avatar from "../components/common/Avatar";
import Modal from "../components/common/Modal";
import StoryProgress from "../components/stories/StoryProgress";
import { useLanguage } from "../context/LanguageContext";
import messageService from "../services/messageService";
import storyService from "../services/storyService";
import { getMediaUrl } from "../utils/constants";
import useAuth from "../hooks/useAuth";
import { getArrayResults } from "../utils/arrayResults";

const IMAGE_DURATION_MS = 5000;
const STORY_LIFETIME_MS = 24 * 60 * 60 * 1000;

function isActiveStory(story) {
  const expiresAt = story.expires_at
    ? new Date(story.expires_at).getTime()
    : new Date(story.created_at).getTime() + STORY_LIFETIME_MS;
  return Number.isFinite(expiresAt) && expiresAt >= Date.now();
}

export default function StoryViewer() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const cachedStories = Array.isArray(location.state?.stories)
    ? location.state.stories.filter(isActiveStory)
    : null;
  const [stories, setStories] = useState(cachedStories || []);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [likePending, setLikePending] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replyPending, setReplyPending] = useState(false);
  const [replyStatus, setReplyStatus] = useState("");
  const [viewersOpen, setViewersOpen] = useState(false);
  const [viewers, setViewers] = useState([]);
  const [viewersLoading, setViewersLoading] = useState(false);
  const [viewersError, setViewersError] = useState("");
  const progressRef = useRef(0);
  const videoRef = useRef(null);

  useEffect(() => {
    let active = true;
    if (
      cachedStories?.some((item) => String(item.id) === String(id))
    ) {
      return () => { active = false; };
    }
    storyService.list()
      .then((data) => {
        if (!active) return;
        setStories(getArrayResults(data, "Stories"));
      })
      .catch((loadError) => {
        console.error("Stories could not be loaded:", loadError);
        if (active) setError(t("storyLoadFailed"));
      });
    return () => { active = false; };
  }, [cachedStories, id, t, user?.id]);

  const groups = useMemo(() => {
    const byAuthor = new Map();
    stories.forEach((story) => {
      const authorId = story.author?.id;
      if (!byAuthor.has(authorId)) {
        byAuthor.set(authorId, { author: story.author, stories: [] });
      }
      byAuthor.get(authorId).stories.push(story);
    });

    return Array.from(byAuthor.values())
      .map((group) => ({
        ...group,
        stories: group.stories.sort(
          (left, right) =>
            new Date(left.created_at) - new Date(right.created_at)
        ),
      }))
      .sort((left, right) => {
        const leftUnseen = left.stories.some((story) => !story.is_seen);
        const rightUnseen = right.stories.some((story) => !story.is_seen);
        return Number(rightUnseen) - Number(leftUnseen);
      });
  }, [stories]);

  const groupIndex = groups.findIndex((group) =>
    group.stories.some((story) => String(story.id) === String(id))
  );
  const group = groups[groupIndex];
  const currentIndex =
    group?.stories.findIndex((story) => String(story.id) === String(id)) ?? -1;
  const story = group?.stories[currentIndex];
  const isOwner = story
    && String(story.author?.id) === String(user?.id);
  const mediaUrl =
    story?.video || story?.image || story?.media_url || story?.media;
  const isVideo = story?.media_type === "video"
    || /\.(mp4|webm|mov)(?:$|\?)/i.test(mediaUrl || "");

  const close = useCallback(() => navigate("/", { replace: true }), [navigate]);
  const move = useCallback((offset) => {
    if (!group || currentIndex < 0) return;
    const nextInGroup = group.stories[currentIndex + offset];
    if (nextInGroup) {
      navigate(`/stories/${nextInGroup.id}`, {
        replace: true,
        state: { stories },
      });
      return;
    }

    const nextGroup = groups[groupIndex + offset];
    if (!nextGroup) {
      close();
      return;
    }
    const nextStory = offset > 0
      ? nextGroup.stories.find((item) => !item.is_seen) || nextGroup.stories[0]
      : nextGroup.stories[nextGroup.stories.length - 1];
    navigate(`/stories/${nextStory.id}`, {
      replace: true,
      state: { stories },
    });
  }, [close, currentIndex, group, groupIndex, groups, navigate, stories]);

  useEffect(() => {
    setProgress(0);
    progressRef.current = 0;
    setIsPaused(false);
    setReplyText("");
    setReplyStatus("");
    if (story && String(story.author?.id) !== String(user?.id)) {
      storyService.markViewed(story.id)
        .then(() => {
          setStories((current) => current.map((item) => (
            String(item.id) === String(story.id)
              ? { ...item, is_seen: true }
              : item
          )));
          window.dispatchEvent(new CustomEvent("ricehub:story-viewed", {
            detail: { storyId: story.id },
          }));
        })
        .catch((viewError) => {
          console.error("Story view could not be recorded:", viewError);
        });
    }
  }, [story?.id, user?.id]);

  useEffect(() => {
    setIsLiked(Boolean(story?.is_liked));
    setLikeCount(story?.like_count || 0);
    setActionError("");
    setViewersOpen(false);
    setViewers([]);
    setReplyText("");
    setReplyStatus("");
  }, [story?.id]);

  const toggleLike = async () => {
    if (!story || likePending) return;
    setLikePending(true);
    setActionError("");
    try {
      const result = await storyService.toggleLike(story.id);
      setIsLiked(Boolean(result.is_liked));
      setLikeCount(result.like_count || 0);
      setStories((current) => current.map((item) => (
        String(item.id) === String(story.id)
          ? {
            ...item,
            is_liked: Boolean(result.is_liked),
            like_count: result.like_count || 0,
          }
          : item
      )));
    } catch (likeError) {
      console.error("Story like could not be updated:", likeError);
      setActionError(t("storyLikeFailed"));
    } finally {
      setLikePending(false);
    }
  };

  const deleteStory = async () => {
    if (!story || !isOwner || deletePending) return;
    setDeletePending(true);
    setActionError("");
    try {
      await storyService.remove(story.id);
      setStories((current) =>
        current.filter((item) => String(item.id) !== String(story.id))
      );
      window.dispatchEvent(new Event("ricehub:stories-updated"));
      const remainingStories = group.stories.filter(
        (item) => String(item.id) !== String(story.id)
      );
      const nextStory = remainingStories[currentIndex]
        || remainingStories[currentIndex - 1];
      if (nextStory) {
        const remaining = stories.filter(
          (item) => String(item.id) !== String(story.id)
        );
        navigate(`/stories/${nextStory.id}`, {
          replace: true,
          state: { stories: remaining },
        });
      } else {
        close();
      }
    } catch (deleteError) {
      console.error("Story could not be deleted:", deleteError);
      setActionError(t("storyDeleteFailed"));
    } finally {
      setDeletePending(false);
    }
  };

  const showViewers = async () => {
    if (!story || !isOwner) return;
    setViewersOpen(true);
    setViewersLoading(true);
    setViewersError("");
    try {
      const result = await storyService.viewers(story.id);
      setViewers(getArrayResults(result, "Story viewers"));
    } catch (viewersLoadError) {
      console.error("Story viewers could not be loaded:", viewersLoadError);
      setViewersError(t("storyViewersLoadFailed"));
    } finally {
      setViewersLoading(false);
    }
  };

  const sendStoryReply = async (event) => {
    event.preventDefault();
    const content = replyText.trim();
    if (!story || isOwner || !content || replyPending) return;

    setReplyPending(true);
    setActionError("");
    setReplyStatus("");
    try {
      const conversation = await messageService.createConversation(
        story.author.username
      );
      if (!conversation?.id) throw new Error("Conversation was not created.");
      await messageService.sendText(
        conversation.id,
        `${t("storyReplyPrefix")} ${content}`
      );
      setReplyText("");
      setReplyStatus(t("storyReplySent"));
    } catch (replyError) {
      console.error("Story reply could not be sent:", replyError);
      setActionError(t("storyReplyFailed"));
    } finally {
      setReplyPending(false);
    }
  };

  const togglePlayback = () => {
    if (isVideo && videoRef.current) {
      const video = videoRef.current;
      if (video.paused) {
        const playRequest = video.play();
        playRequest?.catch(() => setIsPaused(true));
        setIsPaused(false);
      } else {
        video.pause();
        setIsPaused(true);
      }
      return;
    }
    setIsPaused((current) => !current);
  };

  useEffect(() => {
    if (!story || isVideo || isPaused) return undefined;
    const startedAt = Date.now() - (progressRef.current / 100) * IMAGE_DURATION_MS;
    const timer = window.setInterval(() => {
      const nextProgress = Math.min(
        ((Date.now() - startedAt) / IMAGE_DURATION_MS) * 100,
        100
      );
      progressRef.current = nextProgress;
      setProgress(nextProgress);
      if (nextProgress >= 100) {
        window.clearInterval(timer);
        move(1);
      }
    }, 50);
    return () => window.clearInterval(timer);
  }, [isPaused, isVideo, move, story?.id]);

  const nextStory = group?.stories[currentIndex + 1];
  const nextStoryMedia = nextStory?.thumbnail_url
    || nextStory?.image
    || nextStory?.media_url
    || nextStory?.media;

  useEffect(() => {
    if (
      !nextStoryMedia
      || (nextStory?.media_type === "video" && !nextStory.thumbnail_url)
    ) return;
    const preload = new Image();
    preload.decoding = "async";
    preload.src = getMediaUrl(nextStoryMedia);
  }, [nextStory?.media_type, nextStoryMedia]);

  return (
    <main className="story-fullscreen" aria-label={t("storyViewer")}>
      <button className="story-fullscreen-close" onClick={close} aria-label={t("closeStory")}>
        <X size={24} />
      </button>
      {error && <p role="alert">{error}</p>}
      {!error && stories.length > 0 && !story && <p>{t("storyUnavailable")}</p>}
      {!error && stories.length === 0 && <p>{t("storyLoading")}</p>}
      {story && (
        <article className="story-fullscreen-card">
          <StoryProgress
            count={group.stories.length}
            currentIndex={currentIndex}
            progress={progress}
          />
          <header>
            <Avatar user={story.author} size={40} />
            <div className="story-fullscreen-author">
              <strong>{story.author?.first_name || story.author?.username}</strong>
              <time dateTime={story.created_at}>
                {new Date(story.created_at).toLocaleTimeString()}
              </time>
            </div>
            <div className="story-fullscreen-actions">
              <button
                type="button"
                onClick={togglePlayback}
                aria-label={t(isPaused ? "resumeStory" : "pauseStory")}
                aria-pressed={isPaused}
                title={t(isPaused ? "resumeStory" : "pauseStory")}
              >
                {isPaused
                  ? <Play size={18} fill="currentColor" />
                  : <Pause size={18} />}
              </button>
              {isOwner ? (
                <>
                  <button
                    type="button"
                    onClick={showViewers}
                    aria-label={`${t("seenBy")} ${story.view_count || 0}`}
                    title={t("seenBy")}
                  >
                    <Eye size={18} />
                    <span>{story.view_count || 0}</span>
                  </button>
                  <button
                    type="button"
                    onClick={deleteStory}
                    disabled={deletePending}
                    aria-label={t("deleteStory")}
                    title={t("deleteStory")}
                  >
                    <Trash2 size={18} />
                  </button>
                </>
              ) : null}
            </div>
          </header>
          {mediaUrl && (isVideo
            ? (
              <video
                key={story.id}
                ref={videoRef}
                src={getMediaUrl(mediaUrl)}
                poster={story.thumbnail_url ? getMediaUrl(story.thumbnail_url) : undefined}
                controls
                autoPlay={!isPaused}
                playsInline
                preload="metadata"
                onClick={(event) => {
                  const bounds = event.currentTarget.getBoundingClientRect();
                  const nativeControlsHeight = Math.min(64, bounds.height * 0.18);
                  if (
                    bounds.height > 0
                    && event.clientY >= bounds.bottom - nativeControlsHeight
                  ) return;
                  togglePlayback();
                }}
                onTimeUpdate={(event) => {
                  const video = event.currentTarget;
                  if (Number.isFinite(video.duration) && video.duration > 0) {
                    setProgress((video.currentTime / video.duration) * 100);
                  }
                }}
                onPlay={() => setIsPaused(false)}
                onPause={() => setIsPaused(true)}
                onEnded={() => move(1)}
              />
            )
            : (
              <img
                src={getMediaUrl(mediaUrl)}
                alt="Story"
                decoding="async"
                fetchpriority="high"
                role="button"
                tabIndex={0}
                aria-label={t(isPaused ? "resumeStory" : "pauseStory")}
                onClick={togglePlayback}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    togglePlayback();
                  }
                }}
              />
            ))}
          {isPaused && (
            <button
              type="button"
              className="story-paused-indicator"
              onClick={togglePlayback}
              aria-label={t("resumeStory")}
            >
              <Play size={28} fill="currentColor" />
            </button>
          )}
          {(story.caption || story.text) && (
            <p className="story-fullscreen-caption">{story.caption || story.text}</p>
          )}
          {actionError && <p className="story-action-error" role="alert">{actionError}</p>}
          {!isOwner && (
            <footer className="story-fullscreen-footer">
              <form className="story-reply-form" onSubmit={sendStoryReply}>
                <input
                  type="text"
                  value={replyText}
                  onChange={(event) => {
                    setReplyText(event.target.value);
                    setReplyStatus("");
                  }}
                  placeholder={t("replyToStory")}
                  aria-label={t("replyToStory")}
                  maxLength={1000}
                />
                <button
                  type="submit"
                  disabled={!replyText.trim() || replyPending}
                  aria-label={t("sendStoryReply")}
                  title={t("sendStoryReply")}
                >
                  <Send size={18} />
                </button>
              </form>
              <button
                type="button"
                className={`story-fullscreen-like${isLiked ? " is-liked" : ""}`}
                onClick={toggleLike}
                disabled={likePending}
                aria-label={isLiked ? t("unlikeStory") : t("likeStory")}
                aria-pressed={isLiked}
                title={isLiked ? t("unlikeStory") : t("likeStory")}
              >
                <Heart size={21} fill={isLiked ? "currentColor" : "none"} />
                <span>{likeCount}</span>
              </button>
              {replyStatus && (
                <span className="story-reply-status" role="status">{replyStatus}</span>
              )}
            </footer>
          )}
          <button
            className="story-fullscreen-prev"
            onClick={() => move(-1)}
            disabled={currentIndex <= 0 && groupIndex <= 0}
            aria-label={t("previousStory")}
          ><ChevronLeft /></button>
          <button
            className="story-fullscreen-next"
            onClick={() => move(1)}
            disabled={
              currentIndex < 0 ||
              (currentIndex >= group.stories.length - 1 &&
                groupIndex >= groups.length - 1)
            }
            aria-label={t("nextStory")}
          ><ChevronRight /></button>
        </article>
      )}
      <Modal
        open={viewersOpen}
        onClose={() => setViewersOpen(false)}
        title={`${t("seenBy")} ${story?.view_count || 0}`}
      >
        {viewersLoading && <p>{t("loadingViewers")}</p>}
        {viewersError && <p role="alert">{viewersError}</p>}
        {!viewersLoading && !viewersError && viewers.length === 0 && (
          <p>{t("noViewersYet")}</p>
        )}
        {!viewersLoading && !viewersError && viewers.length > 0 && (
          <ul className="story-viewers-list">
            {viewers.map((viewer) => (
              <li key={viewer.id}>
                <Avatar
                  src={viewer.avatar}
                  name={[viewer.first_name, viewer.last_name]
                    .filter(Boolean)
                    .join(" ") || viewer.username}
                  size={38}
                />
                <span>{viewer.first_name || viewer.username}</span>
                {viewer.is_liked && (
                  <Heart
                    className="story-viewer-like"
                    size={18}
                    fill="currentColor"
                    aria-label="Liked this story"
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </main>
  );
}
