import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Eye,
  Heart,
  Trash2,
} from "lucide-react";
import Avatar from "../components/common/Avatar";
import Modal from "../components/common/Modal";
import StoryProgress from "../components/stories/StoryProgress";
import storyService from "../services/storyService";
import { getMediaUrl } from "../utils/constants";
import useAuth from "../hooks/useAuth";
import { getArrayResults } from "../utils/arrayResults";

const IMAGE_DURATION_MS = 5000;

export default function StoryViewer() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stories, setStories] = useState([]);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [progress, setProgress] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [likePending, setLikePending] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [viewersOpen, setViewersOpen] = useState(false);
  const [viewers, setViewers] = useState([]);
  const [viewersLoading, setViewersLoading] = useState(false);
  const [viewersError, setViewersError] = useState("");

  useEffect(() => {
    let active = true;
    storyService.list()
      .then((data) => {
        if (!active) return;
        setStories(getArrayResults(data, "Stories"));
      })
      .catch((loadError) => {
        console.error("Stories could not be loaded:", loadError);
        if (active) setError("This story could not be loaded.");
      });
    return () => { active = false; };
  }, [user?.id]);

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

  const close = useCallback(() => navigate("/", { replace: true }), [navigate]);
  const move = useCallback((offset) => {
    if (!group || currentIndex < 0) return;
    const nextInGroup = group.stories[currentIndex + offset];
    if (nextInGroup) {
      navigate(`/stories/${nextInGroup.id}`, { replace: true });
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
    navigate(`/stories/${nextStory.id}`, { replace: true });
  }, [close, currentIndex, group, groupIndex, groups, navigate]);

  useEffect(() => {
    setProgress(0);
    if (story && String(story.author?.id) !== String(user?.id)) {
      storyService.markViewed(story.id)
        .then(() => window.dispatchEvent(new Event("ricehub:stories-updated")))
        .catch((viewError) => {
          console.error("Story view could not be recorded:", viewError);
        });
    }
  }, [story, user?.id]);

  useEffect(() => {
    setIsLiked(Boolean(story?.is_liked));
    setLikeCount(story?.like_count || 0);
    setActionError("");
    setViewersOpen(false);
    setViewers([]);
  }, [story?.id]);

  const toggleLike = async () => {
    if (!story || likePending) return;
    setLikePending(true);
    setActionError("");
    try {
      const result = await storyService.toggleLike(story.id);
      setIsLiked(Boolean(result.is_liked));
      setLikeCount(result.like_count || 0);
    } catch (likeError) {
      console.error("Story like could not be updated:", likeError);
      setActionError("Your like could not be updated.");
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
        navigate(`/stories/${nextStory.id}`, { replace: true });
      } else {
        close();
      }
    } catch (deleteError) {
      console.error("Story could not be deleted:", deleteError);
      setActionError("This story could not be deleted.");
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
      setViewersError("The viewers list could not be loaded.");
    } finally {
      setViewersLoading(false);
    }
  };

  useEffect(() => {
    if (!story || story.media_type === "video") return undefined;
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      const nextProgress = Math.min(
        ((Date.now() - startedAt) / IMAGE_DURATION_MS) * 100,
        100
      );
      setProgress(nextProgress);
      if (nextProgress >= 100) {
        window.clearInterval(timer);
        move(1);
      }
    }, 50);
    return () => window.clearInterval(timer);
  }, [move, story?.id, story?.media_type]);

  const mediaUrl =
    story?.video || story?.image || story?.media_url || story?.media;
  const isVideo = story?.media_type === "video"
    || /\.(mp4|webm|mov)(?:$|\?)/i.test(mediaUrl || "");

  return (
    <main className="story-fullscreen" aria-label="Story viewer">
      <button className="story-fullscreen-close" onClick={close} aria-label="Close story">
        <X size={24} />
      </button>
      {error && <p role="alert">{error}</p>}
      {!error && stories.length > 0 && !story && <p>This story is no longer available.</p>}
      {!error && stories.length === 0 && <p>Loading stories...</p>}
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
              {isOwner ? (
                <>
                  <button
                    type="button"
                    onClick={showViewers}
                    aria-label={`Seen by ${story.view_count || 0}`}
                    title="Seen by"
                  >
                    <Eye size={18} />
                    <span>{story.view_count || 0}</span>
                  </button>
                  <button
                    type="button"
                    onClick={deleteStory}
                    disabled={deletePending}
                    aria-label="Delete story"
                    title="Delete story"
                  >
                    <Trash2 size={18} />
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className={isLiked ? "is-liked" : ""}
                  onClick={toggleLike}
                  disabled={likePending}
                  aria-label={isLiked ? "Unlike story" : "Like story"}
                  aria-pressed={isLiked}
                  title={isLiked ? "Unlike story" : "Like story"}
                >
                  <Heart size={18} fill={isLiked ? "currentColor" : "none"} />
                  <span>{likeCount}</span>
                </button>
              )}
            </div>
          </header>
          {actionError && <p className="story-action-error" role="alert">{actionError}</p>}
          {mediaUrl && (isVideo
            ? (
              <video
                key={story.id}
                src={getMediaUrl(mediaUrl)}
                controls
                autoPlay
                playsInline
                onTimeUpdate={(event) => {
                  const video = event.currentTarget;
                  if (Number.isFinite(video.duration) && video.duration > 0) {
                    setProgress((video.currentTime / video.duration) * 100);
                  }
                }}
                onEnded={() => move(1)}
              />
            )
            : <img src={getMediaUrl(mediaUrl)} alt="Story" />)}
          {(story.caption || story.text) && <p>{story.caption || story.text}</p>}
          <button
            className="story-fullscreen-prev"
            onClick={() => move(-1)}
            disabled={currentIndex <= 0 && groupIndex <= 0}
            aria-label="Previous story"
          ><ChevronLeft /></button>
          <button
            className="story-fullscreen-next"
            onClick={() => move(1)}
            disabled={
              currentIndex < 0 ||
              (currentIndex >= group.stories.length - 1 &&
                groupIndex >= groups.length - 1)
            }
            aria-label="Next story"
          ><ChevronRight /></button>
        </article>
      )}
      <Modal
        open={viewersOpen}
        onClose={() => setViewersOpen(false)}
        title={`Seen by ${story?.view_count || 0}`}
      >
        {viewersLoading && <p>Loading viewers...</p>}
        {viewersError && <p role="alert">{viewersError}</p>}
        {!viewersLoading && !viewersError && viewers.length === 0 && (
          <p>No viewers yet.</p>
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
