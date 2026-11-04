import { getMediaUrl } from "../../utils/constants";
import Avatar from "../common/Avatar";

export default function StoryAvatar({ author, story, hasUnseen, onSelect }) {
  const media = story.image || story.video || story.media_url || story.media;
  const isVideo = story.media_type === "video"
    || /\.(mp4|webm|mov)(?:$|\?)/i.test(media || "");
  const preview = story.thumbnail_url || media;
  const username = author?.username || "user";
  const text = story.caption ?? story.text;

  return (
    <button
      type="button"
      className={[
        "story-card",
        media && "has-media",
        hasUnseen ? "is-unseen" : "is-seen",
      ].filter(Boolean).join(" ")}
      onClick={onSelect}
      aria-label={`View ${username}'s story`}
    >
      {media ? (
        isVideo && !story.thumbnail_url ? (
          <video src={getMediaUrl(media)} muted playsInline />
        ) : (
          <img src={getMediaUrl(preview)} alt="" />
        )
      ) : (
        <span className="story-text-preview">{text || "Story"}</span>
      )}
      <Avatar user={author} size={38} />
      <strong>{author?.first_name || username}</strong>
    </button>
  );
}
