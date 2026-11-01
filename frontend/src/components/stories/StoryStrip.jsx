import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Avatar from "../common/Avatar";
import communityService from "../../services/communityService";
import { getArrayResults } from "../../utils/arrayResults";
import { getMediaUrl } from "../../utils/constants";

export default function StoryStrip({
  currentUser,
  showCreate = false,
  excludeUserId,
  onlyUserId,
}) {
  const [stories, setStories] = useState([]);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const loadStories = useCallback(async () => {
    try {
      const data = await communityService.stories(onlyUserId);
      setStories(getArrayResults(data, "Stories"));
      setError("");
    } catch (loadError) {
      console.error("Stories could not be loaded:", loadError);
      setError("Stories could not be loaded.");
    }
  }, [onlyUserId]);

  useEffect(() => {
    loadStories();
    const refresh = () => loadStories();
    window.addEventListener("ricehub:stories-updated", refresh);
    return () => window.removeEventListener("ricehub:stories-updated", refresh);
  }, [loadStories]);

  const visibleStories = stories.filter((story) => {
    if (onlyUserId != null) return String(story.author?.id) === String(onlyUserId);
    if (excludeUserId != null) return String(story.author?.id) !== String(excludeUserId);
    return true;
  });

  return (
    <section className="story-strip card" aria-label="Stories">
      <div className="story-strip-heading">
        <div>
          <h2>Stories</h2>
        </div>
        {error && <span className="story-error" role="alert">{error}</span>}
      </div>

      <div className="story-scroller">
        {showCreate && (
          <button
            type="button"
            className="story-card story-create"
            onClick={() => navigate("/create?type=story")}
            aria-label="Create a story"
          >
            <Avatar user={currentUser} size={48} />
            <span className="story-add-icon"><Plus size={18} /></span>
            <strong>Create story</strong>
          </button>
        )}
        {visibleStories.map((story) => (
          <button
            type="button"
            className={`story-card${story.media ? " has-media" : ""}`}
            key={story.id}
            onClick={() => {
              navigate(`/stories/${story.id}`);
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
        {visibleStories.length === 0 && !error && (
          <p className="story-empty">No stories yet. Share the first one.</p>
        )}
      </div>
    </section>
  );
}
