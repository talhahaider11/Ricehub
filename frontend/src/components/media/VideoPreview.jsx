import { useEffect, useMemo, useRef } from "react";

export default function VideoPreview({ file, src, ...videoProps }) {
  const videoRef = useRef(null);
  const previewUrl = useMemo(
    () => (file ? URL.createObjectURL(file) : ""),
    [file]
  );
  const videoSrc = file ? previewUrl : src;

  useEffect(() => {
    if (!previewUrl) return undefined;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(() => {
    if (videoSrc) videoRef.current?.load();
  }, [videoSrc]);

  return (
    <video
      {...videoProps}
      ref={videoRef}
      src={videoSrc || undefined}
      controls
      playsInline
      webkit-playsinline="true"
      preload="auto"
    />
  );
}
