import { useEffect, useState } from "react";

import friendService from "../services/friendService";
import FriendRequest from "../components/friends/FriendRequest";
import Loader from "../components/common/Loader";
import ErrorState from "../components/common/ErrorState";
import { getArrayResults } from "../utils/arrayResults";
import { useLanguage } from "../context/LanguageContext";

export default function FriendRequests() {
  const { t } = useLanguage();
  const [requests, setRequests] =
    useState([]);

  const [loading, setLoading] =
    useState(true);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    setError("");
    friendService
      .requests()
      .then((data) =>
        setRequests(getArrayResults(data, "Friend requests"))
      )
      .catch((loadError) => {
        console.error("Friend requests could not be loaded:", loadError);
        setError(t("friendRequestsLoadFailed"));
      })
      .finally(() =>
        setLoading(false)
      );
  };

  useEffect(load, []);

  const removeRequest = (id) => {
    setRequests((current) =>
      current.filter(
        (request) =>
          request.id !== id
      )
    );
  };

  return (
    <div className="page-container">

      <h1>{t("friendRequestsTitle")}</h1>

      {loading ? (
        <Loader />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : requests.length === 0 ? (
        <div className="empty-state">
          {t("noPendingRequests")}
        </div>
      ) : (
        <div className="request-list">
          {requests.map((request) => (
            <FriendRequest
              key={request.id}
              request={request}
              onRemoved={removeRequest}
              onError={setError}
            />
          ))}
        </div>
      )}

    </div>
  );
}