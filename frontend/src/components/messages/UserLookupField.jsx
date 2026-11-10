import { useState } from "react";
import { Search, UserPlus } from "lucide-react";
import Avatar from "../common/Avatar";
import { useLanguage } from "../../context/LanguageContext";
import userService from "../../services/userService";
import { getArrayResults } from "../../utils/arrayResults";
import { parseUserId } from "../../utils/userId";

function displayName(user) {
  return [user.first_name, user.last_name].filter(Boolean).join(" ") || user.username;
}

export default function UserLookupField({ onSelect, disabled = false }) {
  const { t } = useLanguage();
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const searchUsers = async (event) => {
    event.preventDefault();
    const value = query.trim();
    if (!value) {
      setError(t("enterUserIdOrName"));
      return;
    }

    const numericId = parseUserId(value);
    if (numericId !== null) {
      onSelect(numericId);
      setQuery("");
      setMatches([]);
      setError("");
      return;
    }
    if (value.length < 2) {
      setError(t("enterUserIdOrName"));
      return;
    }

    setLoading(true);
    setError("");
    try {
      const normalizedValue = value.replace(/^@/, "").toLocaleLowerCase();
      const terms = value.split(/\s+/).filter((term) => term.length >= 2);
      const resultSets = await Promise.all(
        terms.map((term) => userService.search(term))
      );
      const usersById = resultSets.map((results) => (
        new Map(
          getArrayResults(results, "Group member search")
            .map((user) => [user.id, user])
        )
      ));
      const users = usersById.length > 1
        ? [...usersById[0].values()].filter((user) => (
          usersById.slice(1).every((results) => results.has(user.id))
        ))
        : [...(usersById[0]?.values() || [])];
      const exactMatches = users.filter((user) => {
        const name = displayName(user).toLocaleLowerCase();
        return user.username.toLocaleLowerCase() === normalizedValue
          || name === normalizedValue;
      });
      const results = exactMatches.length ? exactMatches : users;

      if (results.length === 1) {
        onSelect(results[0].id);
        setQuery("");
        setMatches([]);
      } else if (results.length > 1) {
        setMatches(results);
      } else {
        setError(t("groupUserNotFound"));
      }
    } catch (searchError) {
      console.error("Group member search failed:", searchError);
      setError(t("groupUserSearchFailed"));
    } finally {
      setLoading(false);
    }
  };

  const selectUser = (user) => {
    onSelect(user.id);
    setQuery("");
    setMatches([]);
    setError("");
  };

  return (
    <div className="group-user-lookup">
      <form className="group-user-id-field" onSubmit={searchUsers}>
        <label htmlFor="group-user-lookup">{t("userIdOrName")}</label>
        <div>
          <input
            id="group-user-lookup"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setError("");
            }}
            placeholder={t("userIdOrName")}
            autoComplete="off"
            disabled={disabled || loading}
          />
          <button type="submit" disabled={disabled || loading || !query.trim()}>
            {loading ? t("searching") : (
              <>
                <Search size={16} aria-hidden="true" />
                {t("findUser")}
              </>
            )}
          </button>
        </div>
      </form>
      {matches.length > 0 && (
        <div className="group-user-matches" role="listbox" aria-label={t("matchingUsers")}>
          {matches.map((user) => (
            <button
              type="button"
              role="option"
              aria-selected="false"
              key={user.id}
              onClick={() => selectUser(user)}
            >
              <Avatar user={user} size="small" />
              <span>
                <strong>{displayName(user)}</strong>
                <small>@{user.username} · ID {user.id}</small>
              </span>
              <UserPlus size={18} aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}
