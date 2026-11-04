from friendships.services import get_friend_ids
from users.account_status import is_user_suspended
from users.privacy import get_blocked_user_ids, get_muted_user_ids
from users.models import ProfileVisibility

from .models import Story


def can_view_story(user, story):
    if (
        not user.is_authenticated
        or is_user_suspended(user)
        or not user.is_active
    ):
        return False
    if story.author_id == user.pk:
        return True

    hidden_author_ids = (
        get_blocked_user_ids(user) | get_muted_user_ids(user)
    )
    if story.author_id in hidden_author_ids:
        return False
    author_suspended = is_user_suspended(story.author)
    if not story.author.is_active or author_suspended:
        return False
    if story.visibility == Story.Visibility.PUBLIC:
        if story.author.profile_visibility == ProfileVisibility.PUBLIC:
            return True
    return story.author_id in set(get_friend_ids(user))
