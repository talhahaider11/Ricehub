import { useEffect, useState } from "react";

import SuggestedUserCard from "../components/explore/SuggestedUserCard";
import TrendingCard from "../components/explore/TrendingCard";
import PostCard from "../components/posts/PostCard";
import friendService from "../services/friendService";
import searchService from "../services/searchService";
import useAuth from "../hooks/useAuth";

const emptyExplore = {
  posts: [],
  pagination: { next: null },
  hashtags: [],
  suggested_users: [],
};

function getNextPage(nextUrl) {
  if (!nextUrl) return null;
  const page = Number(
    new URL(nextUrl, window.location.origin).searchParams.get("page")
  );
  return Number.isInteger(page) && page > 0 ? page : null;
}

export default function Explore() {
  const { user: currentUser } = useAuth();
  const [data, setData] = useState(emptyExplore);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sendingUserId, setSendingUserId] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    searchService.explore()
      .then((response) => {
        if (active) setData(response);
      })
      .catch((loadError) => {
        console.error("Explore content could not be loaded:", loadError);
        if (active) setError("Explore content could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const loadMore = async () => {
    const page = getNextPage(data.pagination?.next);
    if (!page || loadingMore) return;

    setLoadingMore(true);
    setError("");
    try {
      const next = await searchService.explore(page);
      setData((current) => ({
        ...next,
        posts: [...current.posts, ...next.posts],
      }));
    } catch (loadError) {
      console.error("More explore posts could not be loaded:", loadError);
      setError("More explore posts could not be loaded.");
    } finally {
      setLoadingMore(false);
    }
  };

  const addFriend = async (suggestedUser) => {
    setSendingUserId(suggestedUser.id);
    setError("");
    try {
      await friendService.send(suggestedUser.id);
      setData((current) => ({
        ...current,
        suggested_users: current.suggested_users.filter(
          (user) => user.id !== suggestedUser.id
        ),
      }));
    } catch (requestError) {
      console.error("Friend request could not be sent:", requestError);
      setError(
        requestError.response?.data?.detail
          || "Friend request could not be sent. Please try again."
      );
    } finally {
      setSendingUserId(null);
    }
  };

  if (loading) return <div className="page-container">Loading Explore...</div>;

  return (
    <main className="page-container">
      <h1>Explore</h1>
      {error && <p className="error" role="alert">{error}</p>}

      <section aria-labelledby="trending-hashtags-heading">
        <h2 id="trending-hashtags-heading">Trending hashtags</h2>
        {data.hashtags.length ? (
          <div className="search-results">
            {data.hashtags.map((hashtag) => (
              <TrendingCard
                key={hashtag.id || hashtag.name}
                hashtag={hashtag}
              />
            ))}
          </div>
        ) : (
          <p className="muted">No trending hashtags yet.</p>
        )}
      </section>

      <section aria-labelledby="suggested-users-heading">
        <h2 id="suggested-users-heading">People you may know</h2>
        {data.suggested_users.map((suggestedUser) => (
          <SuggestedUserCard
            key={suggestedUser.id}
            user={suggestedUser}
            sending={sendingUserId === suggestedUser.id}
            onAddFriend={addFriend}
          />
        ))}
        {!data.suggested_users.length && (
          <p className="muted">No suggestions right now.</p>
        )}
      </section>

      <section aria-labelledby="explore-posts-heading">
        <h2 id="explore-posts-heading">Explore posts</h2>
        {data.posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            currentUser={currentUser}
          />
        ))}
        {!data.posts.length && <p className="muted">No posts to explore yet.</p>}
        {data.pagination?.next && (
          <button type="button" disabled={loadingMore} onClick={loadMore}>
            {loadingMore ? "Loading..." : "Load more"}
          </button>
        )}
      </section>
    </main>
  );
}
