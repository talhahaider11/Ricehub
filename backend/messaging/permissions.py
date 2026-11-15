from .models import Conversation, ConversationMember


def is_conversation_member(user, conversation_id):
    if not user or not user.is_authenticated:
        return False
    if not Conversation.objects.filter(
        pk=conversation_id,
        participants=user,
    ).exists():
        return False
    membership = ConversationMember.objects.filter(
        conversation_id=conversation_id,
        user=user,
    ).first()
    return membership is None or membership.deleted_at is None
