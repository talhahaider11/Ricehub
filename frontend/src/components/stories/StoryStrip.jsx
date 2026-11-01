import { useCallback, useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import Avatar from "../common/Avatar";
import communityService from "../../services/communityService";
import { getArrayResults } from "../../utils/arrayResults";
import { getMediaUrl } from "../../utils/constants";

export default function StoryStrip({
  currentUser,
  composerOpen,
  onComposerOpen,
  onComposerClose,
}) {
  const [stories, setStories] = useState([]);
  const [selectedStory, setSelectedStory] = useState(null);
  const [content, setContent] = useState("");
  const [image, setImage] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const loadStories = useCallback(async () => {
    try {
      const data = await communityService.stories();
      setStories(getArrayResults(data, "Stories"));
      setError("");
    } catch (loadError) {
      console.error("Stories could not be loaded:", loadError);
      setError("Stories could not be loaded.");
    }
  }, []);

  useEffect(() => {
    loadStories();
    const refresh = () => loadStories();
    window.addEventListener("ricehub:stories-updated", refresh);
    return () => window.removeEventListener("ricehub:stories-updated", refresh);
  }, [loadStories]);

  const createStory = async (event) => {
    event.preventDefault();
    const formData = new FormData();
    formData.append("text", content.trim());
    if (image) formData.append("media", image);

    try {
      setSubmitting(true);
      setError("");
      const created = await communityService.createStory(formData);
      setStories((current) => [created, ...current]);
      setContent("");
      setImage(null);
      onComposerClose?.();
    } catch (createError) {
      setError(
        createError.response?.data?.detail ||
          "Your story could not be published."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="story-strip card" aria-label="Stories">
      <div className="story-strip-heading">
        <div>
          <h2>Stories</h2>
          <p>Share a moment that disappears after 24 hours.</p>
        </div>
        {error && <span className="story-error" role="alert">{error}</span>}
      </div>

      <div className="story-scroller">
        <button
          type="button"
          className="story-card story-create"
          onClick={onComposerOpen}
          aria-label="Create a story"
        >
          <Avatar user={currentUser} size={48} />
          <span className="story-add-icon"><Plus size={18} /></span>
          <strong>Create story</strong>
        </button>
        {stories.map((story) => (
          <button
            type="button"
            className={`story-card${story.media ? " has-media" : ""}`}
            key={story.id}
            onClick={() => {
              setSelectedStory(story);
              if (story.author?.id !== currentUser?.id) {
                communityService.viewStory(story.id).catch((viewError) => {
                  console.error("Story view could not be recorded:", viewError);
                });
              }
            }}
            aria-label={`View ${story.author?.username || "user"}'s story`}
          >
            {story.media ? (
              story.media.match(/\.(mp4|webm)(?:$|\?)/i) ? (
                <video src={getMediaUrl(story.media)} muted playsInline />
              ) : (
                <img src={getMediaUrl(story.media)} alt="" />
              )
            ) : (
              <span className="story-text-preview">{story.text}</span>
            )}
            <Avatar user={story.author} size={38} />
            <strong>{story.author?.first_name || story.author?.username}</strong>
          </button>
        ))}
        {stories.length === 0 && !error && (
          <p className="story-empty">No stories yet. Share the first one.</p>
        )}
      </div>

      {composerOpen && (
        <div className="story-modal-backdrop" role="presentation">
          <form
            className="story-composer"
            onSubmit={createStory}
            aria-label="Create story"
          >
            <button
              type="button"
              className="story-modal-close"
              onClick={onComposerClose}
              aria-label="Close story composer"
            >
              <X size={20} />
            </button>
            <h2>Create a story</h2>
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="Share a moment..."
              maxLength={500}
              aria-label="Story text"
            />
            <label className="story-file-picker">
              Add a photo
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => setImage(event.target.files?.[0] || null)}
              />
            </label>
            {image && <span>{image.name}</span>}
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting || (!content.trim() && !image)}
            >
              {submitting ? "Sharing..." : "Share story"}
            </button>
          </form>
        </div>
      )}

      {selectedStory && (
        <div className="story-modal-backdrop" role="presentation">
          <article className="story-viewer" aria-label="Story">
            <button
              type="button"
              className="story-modal-close"
              onClick={() => setSelectedStory(null)}
              aria-label="Close story"
            >
              <X size={20} />
            </button>
            <header>
              <Avatar user={selectedStory.author} size={38} />
              <strong>
                {selectedStory.author?.first_name ||
                  selectedStory.author?.username}
              </strong>
              <time dateTime={selectedStory.created_at}>
                {new Date(selectedStory.created_at).toLocaleTimeString()}
              </time>
            </header>
            {selectedStory.media &&
              (selectedStory.media.match(/\.(mp4|webm)(?:$|\?)/i) ? (
                <video
                  src={getMediaUrl(selectedStory.media)}
                  controls
                  playsInline
                />
              ) : (
                <img src={getMediaUrl(selectedStory.media)} alt="Story" />
              ))}
            {selectedStory.text && <p>{selectedStory.text}</p>}
          </article>
        </div>
      )}
    </section>
  );
}
