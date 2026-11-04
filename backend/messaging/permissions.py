from .models import Conversation


def is_conversation_member(user, conversation_id):
    if not user or not user.is_authenticated:
        return False
    return Conversation.objects.filter(
        pk=conversation_id,
        participants=user,
    ).exists()
