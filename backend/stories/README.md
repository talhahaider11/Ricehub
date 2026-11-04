# Stories

Stories reuse the existing `community.Story` and `community.StoryView` tables
through proxy models, preserving existing records. New image/video uploads
must first go through `/api/media/upload/`; create a story with the resulting
ready `media_id` at `/api/stories/create/`. Text-only stories remain supported.

Stories expire after 24 hours and are excluded from APIs as soon as they
expire. Celery Beat runs `stories.tasks.delete_expired_stories` hourly to
remove expired Story and StoryView rows. The MediaAsset itself is retained;
media deletion is blocked while any Story references it.

The API also supports list/detail, mark-viewed, owner-only viewer lists, and
owner-only deletion. Both the `/api/stories/` API and the older
`/api/community/stories/` routes use the same privacy and suspension checks.
