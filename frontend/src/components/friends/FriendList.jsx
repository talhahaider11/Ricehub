import FriendCard from "./FriendCard";

export default function FriendsList({ friends }) {
  if (!friends.length) {
    return (
      <div className="empty-state">
        <h3>No friends yet</h3>
        <p>Find people and send them a friend request.</p>
      </div>
    );
  }

  return (
    <div className="friends-grid">
      {friends.map((friend) => (
        <FriendCard key={friend.id} friend={friend} />
      ))}
    </div>
  );
}