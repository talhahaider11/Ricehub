import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useLanguage } from "../../context/LanguageContext";

export default function SearchBar() {
  const { t } = useLanguage();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(params.get("q") || "");
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (location.pathname === "/search") {
      setQuery(params.get("q") || "");
    }
  }, [location.pathname, params]);

  const updateQuery = (value) => {
    setQuery(value);
    const nextParams = new URLSearchParams();
    if (value) nextParams.set("q", value);
    if (location.pathname === "/search") {
      setParams(nextParams, { replace: true });
    } else {
      navigate(`/search${value ? `?q=${encodeURIComponent(value)}` : ""}`);
    }
  };

  return (
    <div className="navbar-search">
      <form
        className="search-bar"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          navigate(`/search${query ? `?q=${encodeURIComponent(query)}` : ""}`);
        }}
      >
        <Search size={18} />
        <input
          type="search"
          aria-label={t("searchUsersPosts")}
          value={query}
          onChange={(event) => updateQuery(event.target.value)}
          placeholder={t("searchRiceHub")}
        />
      </form>
    </div>
  );
}