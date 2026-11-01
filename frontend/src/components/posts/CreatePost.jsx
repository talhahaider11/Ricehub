import { useEffect, useState } from "react";
import {
  ChevronDown,
  FileText,
  Image as ImageIcon,
  Layers,
  Smile,
  Video as VideoIcon,
} from "lucide-react";
import postService from "../../services/postService";
import useAuth from "../../hooks/useAuth";
import Avatar from "../common/Avatar";
import Button from "../common/Button";

export default function CreatePost({ onCreated, onCreateStory }) {
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [visibility, setVisibility] = useState("public");
  const [postType, setPostType] = useState("post");
  const [image, setImage] = useState(null);
  const [video, setVideo] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const openMenu = () => setCreateMenuOpen(true);
    window.addEventListener("ricehub:open-create-menu", openMenu);
    return () => window.removeEventListener("ricehub:open-create-menu", openMenu);
  }, []);

  const canSubmit = postType === "reel"
    ? video !== null
    : content.trim().length > 0 || image !== null || video !== null;

  const submit = async (e) => {
    e.preventDefault();
    if (!canSubmit || submitting) return;

    const formData = new FormData();
    formData.append("content", content.trim());
    formData.append("visibility", visibility);
    formData.append("post_type", postType);
    if (image) formData.append("image", image);
    if (video) formData.append("video", video);

    try {
      setSubmitting(true);
      setError("");
      const post = await postService.create(formData);
      setContent("");
      setImage(null);
      setVideo(null);
      setPostType("post");
      onCreated?.(post);
    } catch (createError) {
      setError(
        createError.response?.data?.detail ||
          "Post could not be published."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="card create-post-card" id="create-post" onSubmit={submit}>
      <div className="create-post-top">
        <Avatar src={user?.avatar} name={user?.username} />
        <textarea
          className="post-placeholder"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={`What's on your mind, ${user?.first_name || user?.username}?`}
          aria-label="Post content"
        />
      </div>

      <div className="create-menu-wrap">
        <button
          type="button"
          className="create-menu-trigger"
          aria-expanded={createMenuOpen}
          aria-haspopup="menu"
          onClick={() => setCreateMenuOpen((open) => !open)}
        >
          <Layers size={17} />
          Create {postType === "reel" ? "a reel" : "a post"}
          <ChevronDown size={16} />
        </button>
        {createMenuOpen && (
          <div className="create-menu" role="menu" aria-label="Create content">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setPostType("post");
                setCreateMenuOpen(false);
              }}
            >
              <FileText size={18} /> Post
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setCreateMenuOpen(false);
                onCreateStory?.();
              }}
            >
              <ImageIcon size={18} /> Story
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setPostType("reel");
                setImage(null);
                setCreateMenuOpen(false);
              }}
            >
              <VideoIcon size={18} /> Reel
            </button>
          </div>
        )}
      </div>

      {image && (
        <div className="selected-file">
          <img src={URL.createObjectURL(image)} alt="Selected preview" style={{maxWidth: 100}} />
          <span>{image.name}</span>
          <button type="button" onClick={() => setImage(null)} aria-label="Remove image">✕</button>
        </div>
      )}

      <div className="create-post-actions">
        <div className="left-actions">
          <button type="button" className="icon-button" aria-label="Add emoji" onClick={() => setShowEmoji(!showEmoji)}>
            <Smile size={20} />
          </button>

          <label className="file-button icon-button" aria-label="Add image">
            <ImageIcon size={20} /> Photo
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              disabled={postType === "reel"}
              onChange={(e) => {
                setImage(e.target.files?.[0] || null);
                setVideo(null);
              }}
            />
          </label>
          <label className="file-button icon-button" aria-label="Add short video">
            <VideoIcon size={20} /> {postType === "reel" ? "Reel video" : "Video"}
            <input
              type="file"
              accept="video/mp4,video/webm"
              hidden
              required={false}
              onChange={(e) => {
                setVideo(e.target.files?.[0] || null);
                setImage(null);
              }}
            />
          </label>

          <select
            value={visibility}
            onChange={(e) => setVisibility(e.target.value)}
            aria-label="Select privacy"
          >
            <option value="public">🌍 Public</option>
            <option value="friends">👥 Friends</option>
            <option value="private">🔒 Only me</option>
          </select>
        </div>
        {video && <p className="selected-file">{video.name} · max 50 MB</p>}

        <Button type="submit" disabled={!canSubmit || submitting}>
          {submitting? "Posting..." : "Post"}
        </Button>
      </div>

      {showEmoji && (
        <div className="emoji-picker">
          <button type="button" onClick={() => setContent(c => c + "😊")}>😊</button>
          <button type="button" onClick={() => setContent(c => c + "❤️")}>❤️</button>
          <button type="button" onClick={() => setContent(c => c + "😂")}>😂</button>
          <button type="button" onClick={() => setContent(c => c + "🔥")}>🔥</button>
        </div>
      )}

      {postType === "reel" && !video && (
        <p className="muted" role="status">Choose a video to publish a reel.</p>
      )}
      {error && <p className="error" role="alert">{error}</p>}
    </form>
  );
}