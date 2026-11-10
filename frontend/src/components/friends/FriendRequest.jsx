import { useState } from "react";

import Avatar from "../common/Avatar";
import Button from "../common/Button";
import friendService from "../../services/friendService";
import { useLanguage } from "../../context/LanguageContext";

export default function FriendRequest({
  request,
  onRemoved,
  onError,
}) {
  const { t } = useLanguage();
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
        t("friendRequestAcceptFailed");
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
        t("friendRequestDeclineFailed");
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
            {t("acceptRequest")}
          </Button>

          <Button
            variant="secondary"
            onClick={reject}
            disabled={loading}
          >
            {t("deleteRequest")}
          </Button>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
      </div>

    </div>
  );
}