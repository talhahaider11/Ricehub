import { useEffect, useState } from "react";
import Avatar from "../components/common/Avatar";
import { useLanguage } from "../context/LanguageContext";
import friendService from "../services/friendService";
import searchService from "../services/searchService";
import userService from "../services/userService";

export default function Suggestions() {
  const { t } = useLanguage();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    searchService.suggestions()
      .then((data) => {
        if (active) setUsers(Array.isArray(data) ? data : data.results || []);
      })
      .catch((loadError) => {
        console.error("Suggested accounts could not be loaded:", loadError);
        if (active) setError("Suggested accounts could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const sendRequest = async (userId) => {
    setSendingId(userId);
    setError("");
    try {
      await friendService.send(userId);
      setUsers((current) => current.filter((user) => user.id !== userId));
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Friend request could not be sent.");
    } finally {
      setSendingId(null);
    }
  };

  return (
    <div className="page-container">
      <section className="card suggestions-page">
        <h1>{t("suggestions")}</h1>
        {loading && <p>{t("loadingSuggestions")}</p>}
        {error && <p className="settings-error" role="alert">{error}</p>}
        <div className="suggestions-list">
          {users.map((user) => (
            <article className="suggestion" key={user.id}>
              <Avatar user={user} />
              <div>
                <strong>{user.first_name || user.username}</strong>
                <p>@{user.username}</p>
              </div>
              <button
                type="button"
                disabled={sendingId === user.id}
                onClick={() => void sendRequest(user.id)}
              >
                {sendingId === user.id ? "Sending..." : t("addFriend")}
              </button>
            </article>
          ))}
          {!loading && !users.length && <p>{t("noSuggestions")}</p>}
        </div>
      </section>
    </div>
  );
}
