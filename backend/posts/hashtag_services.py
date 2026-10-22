import re

from .models import Hashtag


HASHTAG_PATTERN = re.compile(
    r"#([A-Za-z0-9_]+)"
)


def extract_hashtags(text):
    if not text:
        return []

    return list(
        set(
            match.lower()
            for match in HASHTAG_PATTERN.findall(text)
        )
    )


def sync_post_hashtags(post):
    names = extract_hashtags(
        post.content
    )

    hashtags = []

    for name in names:
        hashtag, _ = Hashtag.objects.get_or_create(
            name=name
        )

        hashtags.append(hashtag)

    post.hashtags.set(hashtags)