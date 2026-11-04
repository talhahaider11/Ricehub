# Media processing

The `media_app` Django package uses the `media` app label. The separate package
keeps Python source out of `MEDIA_ROOT` (`backend/media`), where uploaded files
are stored.

Video uploads are saved as originals and queued through Celery using
`CELERY_BROKER_URL` (defaults to `REDIS_URL`). Deploy a background worker with
FFmpeg and ffprobe installed, running from `backend`:

```text
celery -A config.celery:app worker --loglevel=INFO
```

Until that worker processes an upload, its original video remains playable and
its processing status stays pending. Missing FFmpeg/ffprobe or a processing
failure is reported as a failed status; videos are never marked ready without
successful processing.

When OCI Object Storage is configured, media URLs are signed and expire after
one hour. Treat them as temporary access links rather than permanent public
URLs. Without complete OCI storage credentials, production falls back to local
disk and logs a warning; Render's local disk is ephemeral.

The authenticated `GET /api/media/<id>/` endpoint returns the current
processing status to the owner so the story composer can wait for videos to
become ready before attaching them.

The production worker also runs Celery Beat for hourly story-expiration
cleanup. Keep it at one instance while Beat is embedded in the worker.
