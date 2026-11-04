import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import userService from "../services/userService";
import searchService from "../services/searchService";
import Avatar from "../components/common/Avatar";
import PostCard from "../components/posts/PostCard";
import Loader from "../components/common/Loader";
import ErrorState from "../components/common/ErrorState";
import useAuth from "../hooks/useAuth";
import { getArrayResults } from "../utils/arrayResults";
import useDebounce from "../hooks/useDebounce";

export default function Search() {
  const [params] = useSearchParams();
  const query = params.get("q") || "";
  const debouncedQuery = useDebounce(query, 400);
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("people");
  const [users, setUsers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [hashtags, setHashtags] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  const [nextPage, setNextPage] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    const normalizedQuery = debouncedQuery.trim().replace(/^#/, "");
    if (normalizedQuery.length < 2) {
      setUsers([]);
      setPosts([]);
      setHashtags([]);
      setGroups([]);
      setNextPage(null);
      setError("");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    setNextPage(null);
    let cancelled = false;

    const fetchData = async () => {
      try {
        if (activeTab === "people") {
          const data = await userService.search(normalizedQuery);
          if (cancelled) return;
          setUsers(getArrayResults(data, "People search"));
          setNextPage(data.next || null);
        } else if (activeTab === "posts") {
          const data = await searchService.posts(normalizedQuery);
          if (cancelled) return;
          setPosts(getArrayResults(data, "Post search"));
          setNextPage(data.next || null);
        } else if (activeTab === "hashtags") {
          const data = await searchService.global(normalizedQuery);
          if (cancelled) return;
          setHashtags(getArrayResults(data.hashtags, "Hashtag search"));
        } else if (activeTab === "groups") {
          const data = await searchService.global(normalizedQuery);
          if (cancelled) return;
          setGroups(getArrayResults(data.groups, "Group search"));
        }
      } catch (searchError) {
        if (cancelled) return;
        console.error("Search results could not be loaded:", searchError);
        setError("Search results could not be loaded.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, activeTab, retryCount]);

  const loadMore = async () => {
    if (!nextPage || loadingMore) return;
    let page;
    try {
      page = Number(new URL(nextPage, window.location.origin).searchParams.get("page"));
    } catch {
      setError("The next search page could not be loaded.");
      return;
    }
    if (!Number.isInteger(page) || page < 1) {
      setError("The next search page could not be loaded.");
      return;
    }

    setLoadingMore(true);
    setError("");
    try {
      const data = activeTab === "people"
        ? await userService.search(debouncedQuery.trim(), page)
        : await searchService.posts(debouncedQuery.trim(), page);
      if (activeTab === "people") {
        setUsers((current) => [...current, ...getArrayResults(data, "People search")]);
      } else {
        setPosts((current) => [...current, ...getArrayResults(data, "Post search")]);
      }
      setNextPage(data.next || null);
    } catch (searchError) {
      console.error("More search results could not be loaded:", searchError);
      setError("More search results could not be loaded.");
    } finally {
      setLoadingMore(false);
    }
  };

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
          className={activeTab === "groups" ? "active" : ""}
          onClick={() => setActiveTab("groups")}
        >
          Groups
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
                  to={`/hashtag/${encodeURIComponent(tag.name)}`}
                  className="search-user"
                >
                  <strong>#{tag.name}</strong>
                  <span>{tag.post_count || 0} posts</span>
                </Link>
              ))}
            </div>
          )}

          {activeTab === "groups" && (
            <div className="search-results">
              {groups.map((group) => (
                <button
                  type="button"
                  key={group.id}
                  className="search-user search-group-result"
                  onClick={() =>
                    navigate(`/discover?tab=${encodeURIComponent("Groups & Pages")}&community=${group.id}`)
                  }
                >
                  <div>
                    <strong>{group.name}</strong>
                    <span>{group.description || `${group.kind} · ${group.member_count} members`}</span>
                  </div>
                </button>
              ))}
              {groups.length === 0 && <p className="muted">No groups found</p>}
            </div>
          )}
        </>
      )}
      {!loading && !error && nextPage && (
        <button type="button" onClick={loadMore} disabled={loadingMore}>
          {loadingMore ? "Loading..." : "Load more"}
        </button>
      )}
    </div>
  );
}