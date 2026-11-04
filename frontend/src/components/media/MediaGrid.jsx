import { useState } from "react";

import MediaViewer from "./MediaViewer";
import VideoPlayer from "./VideoPlayer";

export default function MediaGrid({ media = [] }) {
  const [viewerIndex, setViewerIndex] = useState(null);
  if (!media.length) return null;

  const imageMedia = media.filter((item) => item.media_type === "image");
  const imageIndex = (item) => imageMedia.findIndex((image) => image.id === item.id);

  return (
    <>
      <div className={`media-grid media-count-${Math.min(media.length, 4)}`}>
        {media.map((item) => {
          if (item.media_type === "video") {
            return (
              <VideoPlayer
                key={item.id}
                src={item.url}
                poster={item.thumbnail_url}
                processingStatus={item.processing_status}
              />
            );
          }

          return (
            <button
              type="button"
              className="media-grid-image"
              key={item.id}
              onClick={() => setViewerIndex(imageIndex(item))}
              aria-label={`View ${item.original_filename || "post image"}`}
            >
              <img
                src={item.thumbnail_url || item.url}
                alt={item.original_filename || "Post media"}
                loading="lazy"
              />
            </button>
          );
        })}
      </div>
      {viewerIndex !== null && (
        <MediaViewer
          media={imageMedia}
          index={viewerIndex}
          onChange={setViewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      )}
    </>
  );
}
