# Firebase push notifications

The API persists notifications and sends their Channels event immediately. It
queues Firebase delivery after the database transaction commits; the Celery
worker sends to registered devices and records the result without storing raw
device tokens in the delivery log.

For local development, set `FIREBASE_CREDENTIALS_PATH` to a Firebase service
account JSON file kept outside version control. Hosted workers can instead use
the protected `FIREBASE_CREDENTIALS_JSON` environment variable containing the
service-account JSON. Never put either credential in source control.

Production needs the `ricehub-celery-worker` service from `render.yaml`, a
configured `REDIS_URL`, and Firebase credentials. The worker image includes
FFmpeg for the existing video-processing tasks. A missing Firebase
configuration is recorded as a failed delivery; unregistered tokens are
removed from the owning device list.

The worker runs Celery Beat for the hourly expired-story cleanup schedule.
Keep this Render worker at one instance so only one embedded Beat scheduler
publishes periodic jobs.
