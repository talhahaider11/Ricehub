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
  const [isMuted, setIsMuted] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likePending, setLikePending] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replyPending, setReplyPending] = useState(false);
  const [replyStatus, setReplyStatus] = useState("");
  const [viewersOpen, setViewersOpen] = useState(false);
  const [viewers, setViewers] = useState([]);
  const [viewersLoading, setViewersLoading] = useState(false);
  const [viewersError, setViewersError] = useState("");
  const [imageFallbackIndex, setImageFallbackIndex] = useState(0);
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
        if (active) setError(loadError.message || t("storyLoadFailed"));
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
  const isOwner = story && (
    story.is_owner === true
    || String(story.author?.id ?? story.user?.id) === String(user?.id)
  );
  const mediaUrl =
    story?.video || story?.image || story?.media_url || story?.media;
  const isVideo = story?.media_type === "video"
    || /\.(mp4|webm|mov)(?:$|\?)/i.test(mediaUrl || "");
  const imageCandidates = useMemo(() => (
    [...new Set([
      story?.image,
      story?.media_url,
      story?.media,
      story?.source_media_url,
      story?.thumbnail_url,
    ].filter(Boolean).map(getMediaUrl))]
  ), [story]);
  const imageUrl = imageCandidates[imageFallbackIndex];

  useEffect(() => {
    setImageFallbackIndex(0);
  }, [story?.id, imageCandidates]);

  const close = useCallback((storiesToReturn = stories) => {
    navigate("/", {
      replace: true,
      state: { stories: storiesToReturn },
    });
  }, [navigate, stories]);
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
    setIsMuted(false);
    setReplyText("");
    setReplyStatus("");
    if (story && !isOwner) {
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
  }, [isOwner, story?.id]);

  useEffect(() => {
    setIsLiked(Boolean(story?.is_liked));
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
      const remaining = stories.filter(
        (item) => String(item.id) !== String(story.id)
      );
      const remainingStories = group.stories.filter(
        (item) => String(item.id) !== String(story.id)
      );
      const nextStory = remainingStories[currentIndex]
        || remainingStories[currentIndex - 1];
      if (nextStory) {
        navigate(`/stories/${nextStory.id}`, {
          replace: true,
          state: { stories: remaining },
        });
      } else {
        close(remaining);
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
      setViewers(
        getArrayResults(result, "Story viewers").sort(
          (left, right) => Number(Boolean(right.is_liked)) - Number(Boolean(left.is_liked))
        )
      );
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

  const startVideo = useCallback(async () => {
    const video = videoRef.current;
    if (!isVideo || !video) return;

    try {
      await video.play();
      setIsPaused(false);
      setIsMuted(video.muted);
    } catch {
      video.muted = true;
      setIsMuted(true);
      try {
        await video.play();
        setIsPaused(false);
      } catch {
        setIsPaused(true);
      }
    }
  }, [isVideo]);

  const togglePlayback = () => {
    if (isVideo && videoRef.current) {
      const video = videoRef.current;
      if (video.paused) {
        void startVideo();
      } else {
        video.pause();
        setIsPaused(true);
      }
      return;
    }
    setIsPaused((current) => !current);
  };

  const unmuteVideo = async (event) => {
    event.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    video.muted = false;
    try {
      await video.play();
      setIsMuted(false);
      setIsPaused(false);
    } catch {
      video.muted = true;
      setIsMuted(true);
      setIsPaused(true);
    }
  };

  useEffect(() => {
    if (!story || !isVideo) return undefined;
    void startVideo();
    return () => {
      videoRef.current?.pause();
    };
  }, [isVideo, startVideo, story?.id]);

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

  useEffect(() => {
    const upcomingStories = group?.stories.slice(currentIndex + 1, currentIndex + 3) || [];
    const preloadedVideos = [];

    upcomingStories.forEach((nextStory) => {
      const media = nextStory.video
        || nextStory.image
        || nextStory.media_url
        || nextStory.media;
      if (!media) return;

      const isUpcomingVideo = nextStory.media_type === "video"
        || /\.(mp4|webm|mov)(?:$|\?)/i.test(media);
      if (isUpcomingVideo) {
        const preload = document.createElement("video");
        preload.muted = true;
        preload.playsInline = true;
        preload.preload = "auto";
        preload.setAttribute("aria-hidden", "true");
        preload.style.cssText = "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;";
        preload.src = getMediaUrl(media);
        document.body.appendChild(preload);
        preload.load();
        preloadedVideos.push(preload);
      } else {
        const preload = new Image();
        preload.decoding = "async";
        preload.src = getMediaUrl(media);
      }
    });

    return () => {
      preloadedVideos.forEach((video) => {
        video.pause();
        video.removeAttribute("src");
        video.load();
        video.remove();
      });
    };
  }, [currentIndex, group]);

  return (
    <main className="story-fullscreen" aria-label={t("storyViewer")}>
      <div className="story-fullscreen-top-actions">
        {story && (
          <button
            type="button"
            className="story-fullscreen-pause"
            onClick={togglePlayback}
            aria-label={t(isPaused ? "resumeStory" : "pauseStory")}
            aria-pressed={isPaused}
            title={t(isPaused ? "resumeStory" : "pauseStory")}
          >
            {isPaused
              ? <Play size={18} fill="currentColor" />
              : <Pause size={18} />}
          </button>
        )}
        <button className="story-fullscreen-close" onClick={() => close()} aria-label={t("closeStory")}>
          <X size={24} />
        </button>
      </div>
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
          </header>
          {mediaUrl && (isVideo
            ? (
              <div
                className="story-media-stage"
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
              >
                <video
                  key={story.id}
                  className="select-none pointer-events-none"
                  ref={videoRef}
                  src={getMediaUrl(mediaUrl)}
                  poster={story.thumbnail_url ? getMediaUrl(story.thumbnail_url) : undefined}
                  autoPlay
                  playsInline
                  webkit-playsinline="true"
                  preload="auto"
                  controlsList="nodownload noplaybackrate"
                  disablePictureInPicture
                  onContextMenu={(event) => event.preventDefault()}
                  onLoadedData={() => void startVideo()}
                  onTimeUpdate={(event) => {
                    const video = event.currentTarget;
                    if (Number.isFinite(video.duration) && video.duration > 0) {
                      setProgress((video.currentTime / video.duration) * 100);
                    }
                  }}
                  onPlay={(event) => {
                    setIsPaused(false);
                    setIsMuted(event.currentTarget.muted);
                  }}
                  onPause={() => setIsPaused(true)}
                  onEnded={() => move(1)}
                />
                {isMuted && (
                  <button
                    type="button"
                    className="story-unmute-pill"
                    onClick={unmuteVideo}
                  >
                    Tap to unmute
                  </button>
                )}
              </div>
            )
            : (
              <div
                className="story-media-stage"
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
              >
                {imageUrl ? (
                  <img
                    className="select-none pointer-events-none"
                    src={imageUrl}
                    alt="Story"
                    decoding="async"
                    fetchpriority="high"
                    draggable={false}
                    onError={() => setImageFallbackIndex((index) => (
                      Math.min(index + 1, imageCandidates.length)
                    ))}
                    onContextMenu={(event) => event.preventDefault()}
                  />
                ) : (
                  <p className="story-media-unavailable" role="status">
                    Story image could not be loaded.
                  </p>
                )}
              </div>
            ))}
          {(story.caption || story.text) && (
            <p className="story-fullscreen-caption">{story.caption || story.text}</p>
          )}
          {actionError && <p className="story-action-error" role="alert">{actionError}</p>}
          {isOwner ? (
            <footer className="story-fullscreen-footer story-owner-footer">
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
            </footer>
          ) : (
            <footer className="story-fullscreen-footer">
              <form className="story-reply-form" onSubmit={sendStoryReply}>
                <input
                  type="text"
                  value={replyText}
                  onChange={(event) => {
                    setReplyText(event.target.value);
                    setReplyStatus("");
                  }}
                  placeholder={t("reply")}
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
