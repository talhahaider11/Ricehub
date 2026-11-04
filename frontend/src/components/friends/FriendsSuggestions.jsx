import { useEffect, useState } from "react";

import friendService from "../../services/friendService";
import searchService from "../../services/searchService";
import Avatar from "../common/Avatar";
import { getArrayResults } from "../../utils/arrayResults";

export default function FriendSuggestions() {
  const [users, setUsers] =
    useState([]);
  const [loading, setLoading] = useState(true);
  const [sendingUserId, setSendingUserId] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    searchService.suggestions()
      .then((data) => {
        if (active) {
          setUsers(getArrayResults(data, "Friend suggestions").slice(0, 5));
        }
      })
      .catch((loadError) => {
        console.error("Friend suggestions could not be loaded:", loadError);
        if (active) setError("Friend suggestions could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const sendRequest = async (
    userId
  ) => {
    setSendingUserId(userId);
    setError("");
    try {
      await friendService.send(userId);

      setUsers((current) =>
        current.filter(
          (user) =>
            user.id !== userId
        )
      );
    } catch (requestError) {
      setError(
        requestError.response?.data?.detail ||
          "Friend request could not be sent. Please try again."
      );
    } finally {
      setSendingUserId(null);
    }
  };

  return (
    <div className="card suggestions">

      <h3>People you may know</h3>
      {error && <p className="error" role="alert">{error}</p>}
      {loading && <p className="muted">Loading suggestions...</p>}

      {users.map((user) => (
        <div
          className="suggestion"
          key={user.id}
        >
          <Avatar user={user} />

          <div>
            <strong>
              {user.username}
            </strong>

            <button
              type="button"
              disabled={sendingUserId === user.id}
              onClick={() =>
                sendRequest(user.id)
              }
            >
              {sendingUserId === user.id ? "Sending..." : "Add friend"}
            </button>
          </div>
        </div>
      ))}
      {!loading && !error && users.length === 0 && (
        <p className="muted">No suggestions right now.</p>
      )}

    </div>
  );
}