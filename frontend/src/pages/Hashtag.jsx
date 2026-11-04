import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import PostCard from "../components/posts/PostCard";
import searchService from "../services/searchService";
import useAuth from "../hooks/useAuth";

function getNextPage(nextUrl) {
  if (!nextUrl) return null;
  const page = Number(
    new URL(nextUrl, window.location.origin).searchParams.get("page")
  );
  return Number.isInteger(page) && page > 0 ? page : null;
}

export default function Hashtag() {
  const { tag = "" } = useParams();
  const { user: currentUser } = useAuth();
  const [data, setData] = useState({ hashtag: tag, posts: [], next: null });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    searchService.hashtag(tag)
      .then((response) => {
        if (active) setData(response);
      })
      .catch((loadError) => {
        console.error("Hashtag posts could not be loaded:", loadError);
        if (active) setError("Hashtag posts could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [tag]);

  const loadMore = async () => {
    const page = getNextPage(data.next);
    if (!page || loadingMore) return;
    setLoadingMore(true);
    setError("");
    try {
      const next = await searchService.hashtag(tag, page);
      setData((current) => ({
        ...next,
        posts: [...current.posts, ...next.posts],
      }));
    } catch (loadError) {
      console.error("More hashtag posts could not be loaded:", loadError);
      setError("More hashtag posts could not be loaded.");
    } finally {
      setLoadingMore(false);
    }
  };

  if (loading) return <div className="page-container">Loading hashtag...</div>;

  return (
    <main className="page-container">
      <h1>#{data.hashtag || tag}</h1>
      {error && <p className="error" role="alert">{error}</p>}
      {data.posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          currentUser={currentUser}
        />
      ))}
      {!data.posts.length && !error && <p className="muted">No posts found.</p>}
      {data.next && (
        <button type="button" disabled={loadingMore} onClick={loadMore}>
          {loadingMore ? "Loading..." : "Load more"}
        </button>
      )}
    </main>
  );
}
