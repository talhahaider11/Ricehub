import { useEffect, useState, useCallback } from "react";
import friendService from "../services/friendService";
import FriendList from "../components/friends/FriendList";
import Loader from "../components/common/Loader";
import ErrorState from "../components/common/ErrorState";
import EmptyState from "../components/common/EmptyState";
import { getArrayResults } from "../utils/arrayResults";

export default function Friends() {
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadFriends = useCallback(() => {
    setLoading(true);
    setError(null);
    friendService
     .list()
     .then((data) => {
        setFriends(getArrayResults(data, "Friends"));
      })
     .catch((err) => {
        console.error("Friends could not be loaded:", err);
        setError(err.message || "Failed to load friends");
      })
     .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadFriends();
  }, [loadFriends]);

  if (loading) {
    return (
      <div className="page-container">
        <div className="page-heading"><h1>Friends</h1></div>
        <Loader />
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container">
        <div className="page-heading"><h1>Friends</h1></div>
        <ErrorState message={error} onRetry={loadFriends} />
      </div>
    );
  }

  if (!friends.length) {
    return (
      <div className="page-container">
        <div className="page-heading"><h1>Friends</h1></div>
        <EmptyState
          title="No friends"
          message="Find people to connect with."
        />
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-heading">
        <h1>Friends</h1>
      </div>
      <FriendList friends={friends} />
    </div>
  );
}