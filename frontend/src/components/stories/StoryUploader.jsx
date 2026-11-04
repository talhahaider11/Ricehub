import { useState } from "react";

import { getMediaAsset } from "../../services/mediaService";
import storyService from "../../services/storyService";
import MediaUploader from "../media/MediaUploader";

const PROCESSING_POLL_INTERVAL_MS = 2000;
const MAX_PROCESSING_POLLS = 150;

function getErrorMessage(error) {
  const detail = error.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && typeof detail[0] === "string") {
    return detail[0];
  }

  const mediaError = error.response?.data?.media_id;
  if (Array.isArray(mediaError) && typeof mediaError[0] === "string") {
    return mediaError[0];
  }
  if (typeof mediaError === "string") return mediaError;

  return error.message || "Your story could not be published.";
}

async function waitForMediaReady(mediaId, onProgress) {
  for (let attempt = 0; attempt < MAX_PROCESSING_POLLS; attempt += 1) {
    const asset = await getMediaAsset(mediaId);
    if (asset.processing_status === "ready") return asset;
    if (asset.processing_status === "failed") {
      throw new Error("Video processing failed. Please upload another video.");
    }

    onProgress?.(Math.round(((attempt + 1) * PROCESSING_POLL_INTERVAL_MS) / 1000));
    await new Promise((resolve) => {
      window.setTimeout(resolve, PROCESSING_POLL_INTERVAL_MS);
    });
  }

  throw new Error("Video is still processing. Please try sharing it again shortly.");
}

export default function StoryUploader({ onCreated }) {
  const [caption, setCaption] = useState("");
  const [visibility, setVisibility] = useState("friends");
  const [media, setMedia] = useState(null);
  const [saving, setSaving] = useState(false);
  const [processingSeconds, setProcessingSeconds] = useState(0);
  const [error, setError] = useState("");

  const publishStory = async (event) => {
    event.preventDefault();
    if (saving || (!caption.trim() && !media)) return;

    setSaving(true);
    setError("");
    try {
      let readyMedia = media;
      if (media && media.processing_status !== "ready") {
        readyMedia = await waitForMediaReady(media.id, setProcessingSeconds);
      }

      await storyService.createStory(
        readyMedia?.id,
        visibility,
        caption.trim()
      );
      window.dispatchEvent(new Event("ricehub:stories-updated"));
      setCaption("");
      setMedia(null);
      onCreated?.();
    } catch (publishError) {
      console.error("Story could not be published:", publishError);
      setError(getErrorMessage(publishError));
    } finally {
      setSaving(false);
      setProcessingSeconds(0);
    }
  };

  return (
    <form className="card story-composer" onSubmit={publishStory}>
      <h2>Share a story</h2>
      <textarea
        value={caption}
        onChange={(event) => setCaption(event.target.value)}
        placeholder="Share a moment..."
        maxLength={500}
        aria-label="Story text"
      />
      <label className="story-visibility">
        Who can view this story?
        <select
          value={visibility}
          onChange={(event) => setVisibility(event.target.value)}
          aria-label="Story visibility"
        >
          <option value="friends">Friends</option>
          <option value="public">Public</option>
        </select>
      </label>
      <MediaUploader
        maxFiles={1}
        multiple={false}
        accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
        onUploaded={(assets) => {
          setMedia(assets?.[0] || null);
          setError("");
        }}
      />
      {media && (
        <p className="story-upload-status">
          {media.original_filename || "Media selected"} · {media.processing_status}
        </p>
      )}
      {saving && media?.media_type === "video" && media.processing_status !== "ready" && (
        <p role="status">Processing video... {processingSeconds}s</p>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
      <button
        type="submit"
        className="btn btn-primary"
        disabled={saving || (!caption.trim() && !media)}
      >
        {saving ? "Sharing..." : "Share story"}
      </button>
    </form>
  );
}
