import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import searchService from "../../services/searchService";
import { getArrayResults } from "../../utils/arrayResults";

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
        setResults({
          users: getArrayResults(data.users, "People search"),
          hashtags: getArrayResults(data.hashtags, "Hashtag search"),
          posts: getArrayResults(data.posts, "Post search"),
          groups: getArrayResults(data.groups, "Group search"),
        });
      } catch (error) {
        console.error("Search suggestions could not be loaded:", error);
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
            <Link
              key={`user-${user.id}`}
              to={`/profile/${user.id}`}
              className="search-suggestion-user"
              onClick={() => {
                clearSearch();
              }}
            >
              <strong>{user.username}</strong>
              <small>Person</small>
            </Link>
          ))}

          {results.hashtags?.slice(0, 5).map((hashtag) => (
            <button
              key={`tag-${hashtag.id}`}
              onClick={() => {
                navigate(`/hashtag/${encodeURIComponent(hashtag.name)}`);
                clearSearch();
              }}
            >
              #{hashtag.name}
            </button>
          ))}

          {results.posts?.slice(0, 3).map((post) => (
            <button
              type="button"
              key={`post-${post.id}`}
              onClick={submit}
              className="search-suggestion-result"
            >
              <span>{post.content?.slice(0, 80) || "Photo or video post"}</span>
              <small>Post</small>
            </button>
          ))}

          {results.groups?.slice(0, 3).map((group) => (
            <button
              type="button"
              key={`group-${group.id}`}
              onClick={submit}
              className="search-suggestion-result"
            >
              <span>{group.name}</span>
              <small>Group or page</small>
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