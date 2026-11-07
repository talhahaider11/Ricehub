import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import searchService from "../../services/searchService";
import { getArrayResults } from "../../utils/arrayResults";

export default function SearchBar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 2) {
      setResults(null);
      setLoading(false);
      setError("");
      return;
    }

    let active = true;
    setLoading(true);
    setError("");
    const timeout = setTimeout(async () => {
      try {
        const data = await searchService.global(normalizedQuery);
        if (!active) return;
        setResults({
          users: getArrayResults(data.users, "People search"),
          posts: getArrayResults(data.posts, "Post search"),
        });
      } catch (error) {
        if (!active) return;
        console.error("Search suggestions could not be loaded:", error);
        setResults({ users: [], posts: [] });
        setError("Search suggestions could not be loaded. Try again.");
      } finally {
        if (active) setLoading(false);
      }
    }, 300);

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [query]);

  const submit = (event, type) => {
    event?.preventDefault();
    if (!query.trim()) return;

    const params = new URLSearchParams({ q: query.trim() });
    if (type) params.set("type", type);
    navigate(`/search?${params.toString()}`);
    setResults(null);
  };

  const clearSearch = () => {
    setQuery("");
    setResults(null);
  };

  return (
    <div className="navbar-search">
      <form className="search-bar" role="search" onSubmit={submit}>
        <Search size={18} />
        <input
          role="combobox"
          aria-label="Search users and posts"
          aria-autocomplete="list"
          aria-expanded={query.trim().length >= 2}
          aria-controls="navbar-search-results"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search RiceHub"
        />
      </form>

      {query.trim().length >= 2 && (
        <div className="search-dropdown" id="navbar-search-results" role="listbox" aria-live="polite">
          {loading && <p className="search-suggestion-status">Searching...</p>}
          {error && <p className="search-suggestion-status" role="alert">{error}</p>}
          {results?.users?.slice(0, 5).map((user) => (
            <Link
              key={`user-${user.id}`}
              to={`/profile/${user.id}`}
              className="search-suggestion-user"
              role="option"
              onClick={() => {
                clearSearch();
              }}
            >
              <strong>{user.username}</strong>
              <small>Person</small>
            </Link>
          ))}

          {results?.posts?.slice(0, 3).map((post) => (
            <button
              type="button"
              key={`post-${post.id}`}
              onClick={() => submit(undefined, "posts")}
              className="search-suggestion-result"
              role="option"
            >
              <span>{post.content?.slice(0, 80) || "Photo or video post"}</span>
              <small>Post</small>
            </button>
          ))}

          {!loading && !error && results
            && results.users.length === 0 && results.posts.length === 0 && (
              <p className="search-suggestion-status">No users or posts found.</p>
            )}

          <button type="button" className="view-all-search" onClick={(event) => submit(event)}>
            View all results for "{query.trim()}"
          </button>
        </div>
      )}
    </div>
  );
}