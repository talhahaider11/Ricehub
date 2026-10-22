import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import searchService from "../../services/searchService";

export default function SearchBar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!query.trim()) {
      setResults(null);
      return;
    }

    const timeout = setTimeout(async () => {
      try {
        const data = await searchService.global(query.trim());
        setResults(data);
      } catch {
        setResults(null);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [query]);

  const submit = (event) => {
    event.preventDefault();
    if (!query.trim()) return;

    navigate(`/search?q=${encodeURIComponent(query.trim())}`);
    setResults(null);
  };

  const clearSearch = () => {
    setQuery("");
    setResults(null);
  };

  return (
    <div className="navbar-search">
      <form className="search-bar" onSubmit={submit}>
        <Search size={18} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search RiceHub"
        />
      </form>

      {results && (
        <div className="search-dropdown">
          {results.users?.slice(0, 5).map((user) => (
            <button
              key={`user-${user.id}`}
              onClick={() => {
                navigate(`/profile/${user.id}`);
                clearSearch();
              }}
            >
              <strong>{user.username}</strong>
              <small>Person</small>
            </button>
          ))}

          {results.hashtags?.slice(0, 5).map((hashtag) => (
            <button
              key={`tag-${hashtag.id}`}
              onClick={() => {
                navigate(`/search?q=${encodeURIComponent(`#${hashtag.name}`)}`);
                clearSearch();
              }}
            >
              #{hashtag.name}
            </button>
          ))}

          <button className="view-all-search" onClick={submit}>
            View all results for "{query.trim()}"
          </button>
        </div>
      )}
    </div>
  );
}