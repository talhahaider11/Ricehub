export default function VideoPlayer({
  src,
  poster,
  processingStatus,
}) {
  return (
    <div className="media-video-wrap">
      <video
        src={src}
        poster={poster || undefined}
        controls
        playsInline
        preload="metadata"
        className="post-video"
      >
        Your browser does not support video playback.
      </video>
      {processingStatus && processingStatus !== "ready" && (
        <span className="media-processing-status">
          {processingStatus === "failed"
            ? "Video processing failed; playing original."
            : "Video processing pending; playing original."}
        </span>
      )}
    </div>
  );
}
