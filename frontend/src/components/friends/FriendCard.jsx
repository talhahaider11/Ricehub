import { Link } from "react-router-dom";
import Avatar from "../common/Avatar";

export default function FriendCard({ friend }) {
  const displayName =
    [friend.first_name, friend.last_name].filter(Boolean).join(" ") ||
    friend.username;

  return (
    <div className="friend-card">
      <Link className="friend-card-profile" to={`/profile/${friend.id}`}>
        <Avatar
          src={friend.profile_picture || friend.avatar}
          name={displayName}
          size={52}
        />
        <span>{displayName}</span>
        <small>@{friend.username}</small>
      </Link>
    </div>
  );
}