import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import CreatePost from "../components/posts/CreatePost";
import communityService from "../services/communityService";
import useAuth from "../hooks/useAuth";

export default function CreateContent() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const type = ["post", "story", "reel"].includes(params.get("type"))
    ? params.get("type")
    : "post";
  const [text, setText] = useState("");
  const [media, setMedia] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const publishStory = async (event) => {
    event.preventDefault();
    if ((!text.trim() && !media) || saving) return;
    const formData = new FormData();
    formData.append("text", text.trim());
    if (media) formData.append("media", media);

    try {
      setSaving(true);
      setError("");
      await communityService.createStory(formData);
      window.dispatchEvent(new Event("ricehub:stories-updated"));
      navigate(`/profile/${user.id}`);
    } catch (publishError) {
      setError(
        publishError.response?.data?.detail || "Your story could not be published."
      );
    } finally {
      setSaving(false);
    }
  };

  if (type !== "story") {
    return (
      <div className="page-container create-content-page">
        <h1>Create {type}</h1>
        <CreatePost
          key={type}
          initialPostType={type}
          onCreateStory={() => navigate("/create?type=story")}
          onCreated={() => navigate(`/profile/${user.id}`)}
        />
      </div>
    );
  }

  return (
    <div className="page-container create-content-page">
      <form className="card story-composer" onSubmit={publishStory}>
        <h1>Create a story</h1>
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Share a moment..."
          maxLength={500}
          aria-label="Story text"
        />
        <label className="story-file-picker">
          Add a photo or video
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
            onChange={(event) => setMedia(event.target.files?.[0] || null)}
          />
        </label>
        {media && <span>{media.name}</span>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <button
          type="submit"
          className="btn btn-primary"
          disabled={saving || (!text.trim() && !media)}
        >
          {saving ? "Sharing..." : "Share story"}
        </button>
      </form>
    </div>
  );
}
