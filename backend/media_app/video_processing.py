import json
import shutil
import subprocess
import tempfile
from pathlib import Path

from django.core.files import File
from django.core.files.base import ContentFile

from .models import MediaAsset
from .validators import MAX_IMAGE_DIMENSION, MAX_VIDEO_DURATION


class MediaProcessingError(Exception):
    pass


def process_video_asset(asset):
    ffmpeg = shutil.which("ffmpeg")
    ffprobe = shutil.which("ffprobe")
    if not ffmpeg or not ffprobe:
        raise MediaProcessingError(
            "Video processing requires FFmpeg and ffprobe on the worker."
        )

    suffix = {
        "video/mp4": ".mp4",
        "video/webm": ".webm",
        "video/quicktime": ".mov",
    }[asset.mime_type]

    with tempfile.TemporaryDirectory(prefix="ricehub-media-") as directory:
        input_path = Path(directory) / f"source{suffix}"
        thumbnail_path = Path(directory) / "thumbnail.jpg"
        output_path = Path(directory) / "processed.mp4"

        with asset.file.open("rb") as source, input_path.open("wb") as target:
            shutil.copyfileobj(source, target)

        probe = subprocess.run(
            [
                ffprobe,
                "-v",
                "error",
                "-show_entries",
                "format=duration:stream=codec_type,width,height",
                "-of",
                "json",
                str(input_path),
            ],
            check=True,
            capture_output=True,
            text=True,
            timeout=120,
        )
        metadata = json.loads(probe.stdout)
        video_streams = [
            stream
            for stream in metadata.get("streams", [])
            if stream.get("codec_type") == "video"
        ]
        duration = float(metadata.get("format", {}).get("duration", 0))
        if not video_streams or duration <= 0 or duration > MAX_VIDEO_DURATION:
            raise MediaProcessingError("Videos must be between 0 and 180 seconds long.")

        width = int(video_streams[0].get("width", 0))
        height = int(video_streams[0].get("height", 0))
        if not width or not height or max(width, height) > MAX_IMAGE_DIMENSION:
            raise MediaProcessingError("Video dimensions cannot exceed 8192 pixels.")

        subprocess.run(
            [
                ffmpeg,
                "-y",
                "-ss",
                str(min(1, duration / 2)),
                "-i",
                str(input_path),
                "-frames:v",
                "1",
                "-vf",
                "scale='min(800,iw)':-2",
                str(thumbnail_path),
            ],
            check=True,
            capture_output=True,
            timeout=120,
        )
        subprocess.run(
            [
                ffmpeg,
                "-y",
                "-i",
                str(input_path),
                "-vf",
                "scale='min(1920,iw)':-2",
                "-c:v",
                "libx264",
                "-preset",
                "veryfast",
                "-crf",
                "26",
                "-c:a",
                "aac",
                "-b:a",
                "128k",
                "-movflags",
                "+faststart",
                "-threads",
                "2",
                str(output_path),
            ],
            check=True,
            capture_output=True,
            timeout=1800,
        )

        asset.thumbnail.save(
            f"{asset.pk}_thumbnail.jpg",
            ContentFile(thumbnail_path.read_bytes()),
            save=False,
        )
        with output_path.open("rb") as processed_file:
            asset.compressed_file.save(
                f"{asset.pk}_processed.mp4",
                File(processed_file),
                save=False,
            )
        asset.width = width
        asset.height = height
        asset.duration_seconds = duration
        asset.processing_status = MediaAsset.ProcessingStatus.READY
        asset.processing_error = ""
        asset.save(
            update_fields=[
                "thumbnail",
                "compressed_file",
                "width",
                "height",
                "duration_seconds",
                "processing_status",
                "processing_error",
                "updated_at",
            ]
        )
