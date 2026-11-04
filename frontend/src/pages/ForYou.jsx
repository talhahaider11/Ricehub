import { useCallback, useEffect, useState } from "react";

import FeedTabs from "../components/feed/FeedTabs";
import EmptyState from "../components/common/EmptyState";
import ErrorState from "../components/common/ErrorState";
import InfiniteLoader from "../components/common/InfiniteLoader";
import Loader from "../components/common/Loader";
import PostCard from "../components/posts/PostCard";
import useAuth from "../hooks/useAuth";
import { getForYouFeed } from "../services/feedService";
import { getArrayResults } from "../utils/arrayResults";

function cursorFromUrl(url) {
  if (!url) return null;
  const cursor = new URL(url, window.location.origin).searchParams.get("cursor");
  if (!cursor) throw new Error("The feed returned an invalid pagination cursor.");
  return cursor;
}

export default function ForYou() {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadFeed = useCallback(async ({ refresh = false } = {}) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      const response = await getForYouFeed();
      const results = getArrayResults(response, "For You feed");
      setPosts(results);
      setNextCursor(cursorFromUrl(response.next));
    } catch (loadError) {
      console.error("For You feed could not be loaded:", loadError);
      setError(loadError.message || "For You feed could not be loaded.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  const loadMore = async () => {
    if (!nextCursor || loading || refreshing) return;
    setLoading(true);
    setError("");
    try {
      const response = await getForYouFeed({ cursor: nextCursor });
      setPosts((current) => [
        ...current,
        ...getArrayResults(response, "For You feed"),
      ]);
      setNextCursor(cursorFromUrl(response.next));
    } catch (loadError) {
      console.error("More For You posts could not be loaded:", loadError);
      setError(loadError.message || "More posts could not be loaded.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="page-container">
      <FeedTabs />
      <header className="page-heading">
        <h1>For You</h1>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={refreshing}
          onClick={() => loadFeed({ refresh: true })}
        >
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </header>
      {error && posts.length === 0 ? (
        <ErrorState message={error} onRetry={() => loadFeed()} />
      ) : loading && posts.length === 0 ? (
        <Loader />
      ) : posts.length === 0 ? (
        <EmptyState title="No posts available" message="Your personalized feed is waiting for new posts." />
      ) : (
        <>
          {error && <p className="settings-error" role="alert">{error}</p>}
          <div className="feed">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                currentUser={user}
                trackView
              />
            ))}
          </div>
          <InfiniteLoader
            onLoadMore={loadMore}
            hasMore={Boolean(nextCursor)}
            loading={loading}
          />
        </>
      )}
    </main>
  );
}
