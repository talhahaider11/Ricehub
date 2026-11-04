import { useMemo } from "react";
import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Avatar from "../common/Avatar";
import StoryAvatar from "./StoryAvatar";
import useStories from "../../hooks/useStories";

export default function StoryStrip({
  currentUser,
  showCreate = false,
  excludeUserId,
  onlyUserId,
}) {
  const navigate = useNavigate();
  const { stories, loading, error } = useStories(onlyUserId);

  const visibleStories = stories.filter((story) => {
    if (onlyUserId != null) return String(story.author?.id) === String(onlyUserId);
    if (excludeUserId != null) return String(story.author?.id) !== String(excludeUserId);
    return true;
  });

  const groups = useMemo(() => {
    const byAuthor = new Map();
    visibleStories.forEach((story) => {
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
  }, [visibleStories]);

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
        {groups.map((group) => {
          const story =
            group.stories.find((item) => !item.is_seen) || group.stories[0];
          const hasUnseen = group.stories.some((item) => !item.is_seen);

          return (
            <StoryAvatar
              key={group.author?.id}
              author={group.author}
              story={story}
              hasUnseen={hasUnseen}
              onSelect={() => navigate(`/stories/${story.id}`)}
            />
          );
        })}
        {loading && groups.length === 0 && <p className="story-empty">Loading stories...</p>}
        {!loading && groups.length === 0 && !error && (
          <p className="story-empty">No stories yet. Share the first one.</p>
        )}
      </div>
    </section>
  );
}
