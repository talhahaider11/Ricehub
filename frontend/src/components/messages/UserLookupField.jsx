import { useCallback, useEffect, useRef, useState } from "react";
import { Search, UserPlus } from "lucide-react";
import Avatar from "../common/Avatar";
import VerifiedBadge from "../common/VerifiedBadge";
import { useLanguage } from "../../context/LanguageContext";
import messageService from "../../services/messageService";
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
  const searchVersion = useRef(0);

  const searchUsers = useCallback(async (value) => {
    const searchTerm = value.trim();
    const numericId = parseUserId(searchTerm);
    if (!searchTerm || (searchTerm.length < 2 && numericId === null)) {
      setMatches([]);
      setLoading(false);
      return;
    }

    const version = ++searchVersion.current;
    setLoading(true);
    setError("");
    try {
      const results = await messageService.searchGroupMembers(
      numericId === null
        ? searchTerm.replace(/^@/, "")
        : String(numericId)
      );
      if (version !== searchVersion.current) return;
      const verifiedUsers = getArrayResults(
        results,
        "Group member search"
      ).filter((user) => user.is_verified);
      setMatches(verifiedUsers);
      if (verifiedUsers.length === 0) setError(t("groupUserNotFound"));
    } catch (searchError) {
      if (version !== searchVersion.current) return;
      console.error("Group member search failed:", searchError);
      setError(t("groupUserSearchFailed"));
    } finally {
      if (version === searchVersion.current) setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void searchUsers(query);
    }, 250);
    return () => {
      window.clearTimeout(timer);
      searchVersion.current += 1;
    };
  }, [query, searchUsers]);

  const selectUser = (user) => {
    searchVersion.current += 1;
    onSelect(user.id);
    setQuery("");
    setMatches([]);
    setError("");
  };

  return (
    <div className="group-user-lookup">
      <div className="group-user-id-field">
        <label htmlFor="group-user-lookup">{t("userIdOrName")}</label>
        <div>
          <input
            id="group-user-lookup"
            value={query}
            onChange={(event) => {
              searchVersion.current += 1;
              setQuery(event.target.value);
              setMatches([]);
              setError("");
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void searchUsers(query);
              }
            }}
            placeholder={t("userIdOrName")}
            autoComplete="off"
            disabled={disabled}
          />
          <button
            type="button"
            onClick={() => void searchUsers(query)}
            disabled={disabled || loading || !query.trim()}
          >
            {loading ? t("searching") : (
              <>
                <Search size={16} aria-hidden="true" />
                {t("findUser")}
              </>
            )}
          </button>
        </div>
      </div>
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
              <VerifiedBadge verified={user.is_verified} />
              <UserPlus size={18} aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}
