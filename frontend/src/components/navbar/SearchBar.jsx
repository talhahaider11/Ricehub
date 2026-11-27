import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useLanguage } from "../../context/LanguageContext";

export default function SearchBar() {
  const { t } = useLanguage();
  const [params] = useSearchParams();
  const [query, setQuery] = useState(params.get("q") || "");
  const location = useLocation();
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const isSearchPage = location.pathname === "/search";

  const updateQuery = (value) => {
    setQuery(value);
    if (isSearchPage) {
      navigate(`/search${value ? `?q=${encodeURIComponent(value)}` : ""}`, {
        replace: true,
      });
    }
  };

  useEffect(() => {
    if (isSearchPage) {
      setQuery(params.get("q") || "");
    }
  }, [isSearchPage, params]);

  useEffect(() => {
    if (isSearchPage) {
      inputRef.current?.focus();
    }
  }, [isSearchPage]);

  return (
    <div className="navbar-search">
      <form
        className="search-bar"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          navigate(`/search${query ? `?q=${encodeURIComponent(query)}` : ""}`, {
            replace: isSearchPage,
          });
        }}
      >
        <Search size={18} />
        <input
          id="navbar-search-input"
          ref={inputRef}
          type="search"
          style={{
            border: "none",
            outline: "none",
            boxShadow: "none",
            background: "transparent",
          }}
          aria-label={t("searchUsersPosts")}
          value={query}
          onFocus={() => {
            if (!isSearchPage) {
              navigate(`/search${query ? `?q=${encodeURIComponent(query)}` : ""}`);
            }
          }}
          onChange={(event) => updateQuery(event.target.value)}
          placeholder={t("searchRiceHub")}
          autoFocus={isSearchPage}
        />
      </form>
    </div>
  );
}