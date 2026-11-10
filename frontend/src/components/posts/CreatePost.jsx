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
import MediaUploader from "../media/MediaUploader";
import { deleteMedia } from "../../services/mediaService";
import { MAX_POST_MEDIA_COUNT } from "../../utils/constants";

export default function CreatePost({
  onCreated,
  onCreateStory,
  initialPostType = "post",
}) {
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [visibility, setVisibility] = useState("public");
  const [postType, setPostType] = useState(initialPostType);
  const [mediaAssets, setMediaAssets] = useState([]);
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
    ? mediaAssets.some((asset) => asset.media_type === "video")
    : content.trim().length > 0 || mediaAssets.length > 0;

  const submit = async (e) => {
    e.preventDefault();
    if (!canSubmit || submitting) return;

    const formData = new FormData();
    formData.append("content", content.trim());
    formData.append("visibility", visibility);
    formData.append("post_type", postType);
    mediaAssets.forEach((asset) => formData.append("media_ids", asset.id));

    try {
      setSubmitting(true);
      setError("");
      const post = await postService.create(formData);
      setContent("");
      setMediaAssets([]);
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

  const removeMedia = async (assetId) => {
    setError("");
    try {
      await deleteMedia(assetId);
      setMediaAssets((assets) => assets.filter((asset) => asset.id !== assetId));
    } catch (removeError) {
      setError(
        removeError.response?.data?.detail ||
          "The uploaded media could not be removed."
      );
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
                setCreateMenuOpen(false);
              }}
            >
              <VideoIcon size={18} /> Reel
            </button>
          </div>
        )}
      </div>

      <MediaUploader
        maxFiles={MAX_POST_MEDIA_COUNT - mediaAssets.length}
        onUploaded={(uploaded) =>
          setMediaAssets((current) => [...current, ...uploaded])
        }
      />
      {mediaAssets.length > 0 && (
        <div className="media-uploaded-list" aria-label="Uploaded media">
          {mediaAssets.map((asset) => (
            <div className="media-uploaded-item" key={asset.id}>
              {asset.media_type === "video" ? (
                <video src={asset.url} controls playsInline preload="metadata" />
              ) : (
                <img
                  src={asset.thumbnail_url || asset.url}
                  alt={asset.original_filename || "Selected media"}
                />
              )}
              <span>{asset.original_filename}</span>
              <button
                type="button"
                onClick={() => void removeMedia(asset.id)}
                aria-label={`Remove ${asset.original_filename || "uploaded media"}`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="create-post-actions">
        <div className="left-actions">
          <button type="button" className="icon-button" aria-label="Add emoji" onClick={() => setShowEmoji(!showEmoji)}>
            <Smile size={20} />
          </button>

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
        <Button type="submit" disabled={!canSubmit || submitting}>
          {submitting ? "Posting..." : "Post"}
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

      {postType === "reel" && !mediaAssets.some((asset) => asset.media_type === "video") && (
        <p className="muted" role="status">Choose a video to publish a reel.</p>
      )}
      {error && <p className="error" role="alert">{error}</p>}
    </form>
  );
}