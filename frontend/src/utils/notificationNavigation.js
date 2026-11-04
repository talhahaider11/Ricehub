export function getNotificationPath(notification = {}) {
  const type = notification.notification_type || notification.type;
  const postId = notification.post_id;
  const conversationId = notification.conversation_id;
  const senderId = notification.sender_id;

  if (conversationId) {
    return `/messages?conversation_id=${encodeURIComponent(conversationId)}`;
  }

  if ((type === "comment" || type === "reaction") && postId) {
    return `/posts/${encodeURIComponent(postId)}`;
  }

  if (type === "friend_request") {
    return "/friend-requests";
  }

  if (type === "friend_accepted" && senderId) {
    return `/profile/${encodeURIComponent(senderId)}`;
  }

  if (type === "event_invitation") {
    return "/discover";
  }

  return "/notifications";
}
