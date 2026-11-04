import { Link } from "react-router-dom";
import Avatar from "../common/Avatar";

export default function SuggestedUserCard({
  user,
  onAddFriend,
  sending = false,
}) {
  return (
    <article className="suggestion">
      <Link to={`/profile/${user.id}`} aria-label={`View @${user.username}'s profile`}>
        <Avatar user={user} />
      </Link>
      <strong>@{user.username}</strong>
      <button
        type="button"
        disabled={sending}
        onClick={() => onAddFriend(user)}
      >
        {sending ? "Sending..." : "Add friend"}
      </button>
    </article>
  );
}
