export default function UploadProgress({ progress, filename }) {
  return (
    <div className="media-upload-progress" role="status" aria-live="polite">
      <span>
        Uploading {filename} ({progress}%)
      </span>
      <progress max="100" value={progress}>
        {progress}%
      </progress>
    </div>
  );
}
