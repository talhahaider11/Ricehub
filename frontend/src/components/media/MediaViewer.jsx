import { useEffect } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

export default function MediaViewer({ media, index, onChange, onClose }) {
  const item = media[index];

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") onChange(Math.max(0, index - 1));
      if (event.key === "ArrowRight") {
        onChange(Math.min(media.length - 1, index + 1));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [index, media.length, onChange, onClose]);

  if (!item) return null;

  return (
    <div
      className="media-viewer"
      role="dialog"
      aria-modal="true"
      aria-label="View post image"
      onClick={onClose}
    >
      <button
        type="button"
        className="media-viewer-close"
        aria-label="Close image viewer"
        onClick={onClose}
      >
        <X size={25} />
      </button>
      {index > 0 && (
        <button
          type="button"
          className="media-viewer-prev"
          aria-label="Previous image"
          onClick={(event) => {
            event.stopPropagation();
            onChange(index - 1);
          }}
        >
          <ChevronLeft size={30} />
        </button>
      )}
      <img
        src={item.url}
        alt={item.original_filename || "Post media"}
        onClick={(event) => event.stopPropagation()}
      />
      {index < media.length - 1 && (
        <button
          type="button"
          className="media-viewer-next"
          aria-label="Next image"
          onClick={(event) => {
            event.stopPropagation();
            onChange(index + 1);
          }}
        >
          <ChevronRight size={30} />
        </button>
      )}
    </div>
  );
}
