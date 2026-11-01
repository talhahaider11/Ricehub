import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import Avatar from "../components/common/Avatar";
import communityService from "../services/communityService";
import { getArrayResults } from "../utils/arrayResults";
import { getMediaUrl } from "../utils/constants";
import useAuth from "../hooks/useAuth";

export default function StoryViewer() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stories, setStories] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([
      communityService.stories(),
      user?.id ? communityService.stories(user.id) : Promise.resolve([]),
    ])
      .then(([data, ownData]) => {
        if (!active) return;
        const allStories = [
          ...getArrayResults(data, "Stories"),
          ...getArrayResults(ownData, "Your stories"),
        ];
        setStories([...new Map(allStories.map((item) => [item.id, item])).values()]);
      })
      .catch((loadError) => {
        console.error("Stories could not be loaded:", loadError);
        if (active) setError("This story could not be loaded.");
      });
    return () => { active = false; };
  }, [user?.id]);

  const currentIndex = stories.findIndex((story) => String(story.id) === String(id));
  const story = stories[currentIndex];

  useEffect(() => {
    if (story && String(story.author?.id) !== String(user?.id)) {
      communityService.viewStory(story.id).catch((viewError) => {
        console.error("Story view could not be recorded:", viewError);
      });
    }
  }, [story, user?.id]);

  const move = (offset) => {
    const next = stories[currentIndex + offset];
    if (next) navigate(`/stories/${next.id}`, { replace: true });
  };

  const isVideo = /\.(mp4|webm)(?:$|\?)/i.test(story?.media || "");

  return (
    <main className="story-fullscreen" aria-label="Story viewer">
      <button className="story-fullscreen-close" onClick={() => navigate(-1)} aria-label="Close story">
        <X size={24} />
      </button>
      {error && <p role="alert">{error}</p>}
      {!error && stories.length > 0 && !story && <p>This story is no longer available.</p>}
      {story && (
        <article className="story-fullscreen-card">
          <header>
            <Avatar user={story.author} size={40} />
            <div>
              <strong>{story.author?.first_name || story.author?.username}</strong>
              <time dateTime={story.created_at}>
                {new Date(story.created_at).toLocaleTimeString()}
              </time>
            </div>
          </header>
          {story.media && (isVideo
            ? <video src={getMediaUrl(story.media)} controls autoPlay playsInline />
            : <img src={getMediaUrl(story.media)} alt="Story" />)}
          {story.text && <p>{story.text}</p>}
          <button
            className="story-fullscreen-prev"
            onClick={() => move(-1)}
            disabled={currentIndex <= 0}
            aria-label="Previous story"
          ><ChevronLeft /></button>
          <button
            className="story-fullscreen-next"
            onClick={() => move(1)}
            disabled={currentIndex < 0 || currentIndex >= stories.length - 1}
            aria-label="Next story"
          ><ChevronRight /></button>
        </article>
      )}
    </main>
  );
}
