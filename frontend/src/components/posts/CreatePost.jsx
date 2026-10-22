import { useState } from "react";
import { Smile, Image as ImageIcon, Video as VideoIcon } from "lucide-react";
import postService from "../../services/postService";
import useAuth from "../../hooks/useAuth";
import Avatar from "../common/Avatar";
import Button from "../common/Button";

export default function CreatePost({ onCreated }) {
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [visibility, setVisibility] = useState("public");
  const [image, setImage] = useState(null);
  const [video, setVideo] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = content.trim().length > 0 || image !== null || video !== null;

  const submit = async (e) => {
    e.preventDefault();
    if (!canSubmit || submitting) return;

    const formData = new FormData();
    formData.append("content", content.trim());
    formData.append("visibility", visibility);
    if (image) formData.append("image", image);
    if (video) formData.append("video", video);

    try {
      setSubmitting(true);
      setError("");
      const post = await postService.create(formData);
      setContent("");
      setImage(null);
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
    <form className="card create-post-card" onSubmit={submit}>
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
              onChange={(e) => {
                setImage(e.target.files?.[0] || null);
                setVideo(null);
              }}
            />
          </label>
          <label className="file-button icon-button" aria-label="Add short video">
            <VideoIcon size={20} /> Video
            <input
              type="file"
              accept="video/mp4,video/webm"
              hidden
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

      {error && <p className="error" role="alert">{error}</p>}
    </form>
  );
}