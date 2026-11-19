import { useEffect, useRef, useState } from "react";

export default function VideoPreview({ file, src, ...videoProps }) {
  const videoRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState("");

  useEffect(() => {
    if (!file) {
      setPreviewUrl("");
      return undefined;
    }

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const videoSrc = file ? previewUrl : src;
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
