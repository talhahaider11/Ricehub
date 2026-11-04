from django.core.cache import cache


FEED_CACHE_TIMEOUT = 30


def feed_cache_key(user_id, candidate_limit):
    return f"feed:user:{user_id}:candidates:{candidate_limit}"


def get_cached_feed(user_id, candidate_limit):
    cached = cache.get(feed_cache_key(user_id, candidate_limit))
    if not cached:
        return cached

    if not isinstance(cached, list):
        return None

    from posts.models import Post

    valid_ids = set(
        Post.objects.filter(pk__in=cached).values_list("pk", flat=True)
    )
    if len(valid_ids) != len(cached):
        return None

    if set(cached) != valid_ids:
        return None

    return cached


def set_cached_feed(user_id, candidate_limit, post_ids):
    cache.set(
        feed_cache_key(user_id, candidate_limit),
        post_ids,
        FEED_CACHE_TIMEOUT,
    )


def invalidate_feed(user_id):
    for candidate_limit in (200, 300):
        cache.delete(feed_cache_key(user_id, candidate_limit))
