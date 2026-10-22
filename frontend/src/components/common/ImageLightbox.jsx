import { X } from "lucide-react";

export default function ImageLightbox({
  src,
  open,
  onClose,
}) {
  if (!open) return null;

  return (
    <div
      className="lightbox"
      onClick={onClose}
    >
      <button
        className="lightbox-close"
        onClick={onClose}
      >
        <X size={28} />
      </button>

      <img
        src={src}
        alt="Full size"
        onClick={(event) =>
          event.stopPropagation()
        }
      />
    </div>
  );
}