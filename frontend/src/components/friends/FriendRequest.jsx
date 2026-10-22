import { useState } from "react";

import Avatar from "../common/Avatar";
import Button from "../common/Button";
import friendService from "../../services/friendService";

export default function FriendRequest({
  request,
  onRemoved,
  onError,
}) {
  const [loading, setLoading] =
    useState(false);
  const [error, setError] = useState("");

  const user =
    request.sender || request.from_user;

  const accept = async () => {
    try {
      setLoading(true);
      setError("");

      await friendService.accept(
        request.id
      );

      onRemoved?.(request.id);
    } catch (requestError) {
      const message =
        requestError.response?.data?.detail ||
        "Friend request could not be accepted.";
      setError(message);
      onError?.(message);
    } finally {
      setLoading(false);
    }
  };

  const reject = async () => {
    try {
      setLoading(true);
      setError("");

      await friendService.reject(
        request.id
      );

      onRemoved?.(request.id);
    } catch (requestError) {
      const message =
        requestError.response?.data?.detail ||
        "Friend request could not be declined.";
      setError(message);
      onError?.(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="friend-request">

      <Avatar user={user} />

      <div className="friend-request-info">
        <strong>
          {user?.username}
        </strong>

        <div>
          <Button
            onClick={accept}
            disabled={loading}
          >
            Accept
          </Button>

          <Button
            variant="secondary"
            onClick={reject}
            disabled={loading}
          >
            Delete
          </Button>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
      </div>

    </div>
  );
}