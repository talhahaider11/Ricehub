# Stories

Stories reuse the existing `community.Story` and `community.StoryView` tables
through proxy models, preserving existing records. New image/video uploads
must first go through `/api/media/upload/`; create a story with the resulting
ready `media_id` at `/api/stories/create/`. Text-only stories remain supported.

Stories expire 24 hours after `created_at` and are excluded from APIs as soon
as they expire. Celery Beat runs `stories.tasks.delete_expired_stories` hourly
to remove expired Story and StoryView rows and unreferenced story-owned media.
Referenced `MediaAsset` records are retained.

The API also supports list/detail, mark-viewed, owner-only viewer lists and
deletion, and likes. Viewer lists place users who liked the story before other
viewers, with both groups ordered by most recent view. Both the
`/api/stories/` API and the older `/api/community/stories/` routes use the same
privacy and suspension checks.
