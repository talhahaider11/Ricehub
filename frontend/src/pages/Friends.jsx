import { useEffect, useState, useCallback } from "react";
import friendService from "../services/friendService";
import FriendList from "../components/friends/FriendList";
import Loader from "../components/common/Loader";
import ErrorState from "../components/common/ErrorState";
import EmptyState from "../components/common/EmptyState";
import { getArrayResults } from "../utils/arrayResults";
import { useLanguage } from "../context/LanguageContext";

export default function Friends() {
  const { t } = useLanguage();
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
        setError(err.message || t("friendsLoadFailed"));
      })
     .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => {
    loadFriends();
  }, [loadFriends]);

  if (loading) {
    return (
      <div className="page-container">
        <div className="page-heading"><h1>{t("friendsPageTitle")}</h1></div>
        <Loader />
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container">
        <div className="page-heading"><h1>{t("friendsPageTitle")}</h1></div>
        <ErrorState message={error} onRetry={loadFriends} />
      </div>
    );
  }

  if (!friends.length) {
    return (
      <div className="page-container">
        <div className="page-heading"><h1>{t("friendsPageTitle")}</h1></div>
        <EmptyState
          title={t("noFriendsTitle")}
          message={t("findPeopleToConnect")}
        />
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-heading">
        <h1>{t("friendsPageTitle")}</h1>
      </div>
      <FriendList friends={friends} />
    </div>
  );
}