import { useRef } from "react";
import { getMediaUrl } from "../../utils/constants";
import Avatar from "../common/Avatar";

export default function StoryAvatar({ author, story, hasUnseen, onSelect }) {
  const preloadedMedia = useRef(new Map());
  const media = story.image || story.video || story.media_url || story.media;
  const isVideo = story.media_type === "video"
    || /\.(mp4|webm|mov)(?:$|\?)/i.test(media || "");
  const preview = story.thumbnail_url || media;
  const username = author?.username || "user";
  const text = story.caption ?? story.text;
  const preloadStoryMedia = () => {
    if (!media || preloadedMedia.current.has(media)) return;
    if (isVideo) {
      const video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.preload = "auto";
      video.src = getMediaUrl(media);
      video.load();
      preloadedMedia.current.set(media, video);
      return;
    }
    const image = new Image();
    image.decoding = "async";
    image.src = getMediaUrl(media);
    preloadedMedia.current.set(media, image);
  };

  return (
    <button
      type="button"
      className={[
        "story-card",
        media && "has-media",
        hasUnseen ? "is-unseen" : "is-seen",
      ].filter(Boolean).join(" ")}
      onClick={onSelect}
      onTouchStart={preloadStoryMedia}
      onMouseEnter={preloadStoryMedia}
      onFocus={preloadStoryMedia}
      aria-label={`View ${username}'s story`}
    >
      {media ? (
        isVideo && !story.thumbnail_url ? (
          <video src={getMediaUrl(media)} muted playsInline preload="none" />
        ) : (
          <img
            src={getMediaUrl(preview)}
            alt=""
            loading="lazy"
            decoding="async"
            fetchpriority="low"
          />
        )
      ) : (
        <span className="story-text-preview">{text || "Story"}</span>
      )}
      <Avatar user={author} size={38} />
      <strong>{author?.first_name || username}</strong>
    </button>
  );
}
