import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import userService from "../services/userService";
import searchService from "../services/searchService";
import Avatar from "../components/common/Avatar";
import PostCard from "../components/posts/PostCard";
import Loader from "../components/common/Loader";
import ErrorState from "../components/common/ErrorState";
import useAuth from "../hooks/useAuth";

export default function Search() {
  const [params] = useSearchParams();
  const query = params.get("q") || "";
  const { user: currentUser } = useAuth();

  const [activeTab, setActiveTab] = useState("people");
  const [users, setUsers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [hashtags, setHashtags] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!query.trim()) {
      setUsers([]);
      setPosts([]);
      setHashtags([]);
      setError("");
      return;
    }

    setLoading(true);
    setError("");

    const fetchData = async () => {
      try {
        if (activeTab === "people") {
          const data = await userService.search(query);
          setUsers(data.results || data);
        } else if (activeTab === "posts") {
          const data = await searchService.global(query);
          setPosts(data.posts || []);
        } else if (activeTab === "hashtags") {
          const data = await searchService.global(query);
          setHashtags(data.hashtags || []);
        }
      } catch {
        setError("Search results could not be loaded.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [query, activeTab, retryCount]);

  return (
    <div className="page-container">
      <h1>Search results</h1>
      <p className="muted">Results for "{query}"</p>

      <div className="search-tabs">
        <button
          className={activeTab === "people"? "active" : ""}
          onClick={() => setActiveTab("people")}
        >
          People
        </button>
        <button
          className={activeTab === "posts"? "active" : ""}
          onClick={() => setActiveTab("posts")}
        >
          Posts
        </button>
        <button
          className={activeTab === "hashtags"? "active" : ""}
          onClick={() => setActiveTab("hashtags")}
        >
          Hashtags
        </button>
      </div>

      {error ? (
        <ErrorState
          message={error}
          onRetry={() => setRetryCount((count) => count + 1)}
        />
      ) : loading? (
        <Loader />
      ) : (
        <>
          {activeTab === "people" && (
            <div className="search-results">
              {users.map((user) => (
                <Link
                  key={user.id}
                  to={`/profile/${user.id}`}
                  className="search-user"
                >
                  <Avatar user={user} />
                  <div>
                    <strong>{user.first_name || user.username}</strong>
                    <span>@{user.username}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {activeTab === "posts" && (
            <div className="search-results">
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  currentUser={currentUser}
                />
              ))}
              {posts.length === 0 && <p className="muted">No posts found</p>}
            </div>
          )}

          {activeTab === "hashtags" && (
            <div className="search-results">
              {hashtags.map((tag) => (
                <Link
                  key={tag.id}
                  to={`/search?q=%23${encodeURIComponent(tag.name)}`}
                  className="search-user"
                >
                  <strong>#{tag.name}</strong>
                  <span>{tag.post_count || 0} posts</span>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}