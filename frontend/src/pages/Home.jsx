import { useState } from "react";
import StoryStrip from "../components/stories/StoryStrip";
import PostCard from "../components/posts/PostCard";
import InfiniteLoader from "../components/common/InfiniteLoader";
import PostSkeleton from "../components/common/PostSkeleton";
import ErrorState from "../components/common/ErrorState";
import EmptyState from "../components/common/EmptyState";

import usePosts from "../hooks/usePosts";
import useAuth from "../hooks/useAuth";

export default function Home() {
  const { user } = useAuth();
  const [feedSort, setFeedSort] = useState("recent");

  const {
    posts,
    loading,
    error,
    hasMore,
    loadMore,
    loadPosts,
    removePost,
    updatePost,
  } = usePosts(feedSort);

  return (
    <div className="page-container">
      <div className="feed">
        <StoryStrip
          currentUser={user}
          excludeUserId={user?.id}
        />
        {loading && posts.length === 0 ? (
          <>
            <PostSkeleton />
            <PostSkeleton />
          </>
        ) : error && posts.length === 0 ? (
          <ErrorState message={error} onRetry={loadPosts} />
        ) : (
          <>
        <label className="feed-sort">
          <span>Feed order</span>
          <select
            value={feedSort}
            onChange={(event) => setFeedSort(event.target.value)}
            aria-label="Feed order"
          >
            <option value="recent">Most recent</option>
            <option value="popular">Popular</option>
          </select>
        </label>

        {posts.length === 0 ? (
          <EmptyState
            title="No posts yet"
            message="Your feed is waiting for something new."
          />
        ) : (
          posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              currentUser={user}
              onDeleted={removePost}
              onUpdated={updatePost}
            />
          ))
        )}

        <InfiniteLoader
          onLoadMore={loadMore}
          hasMore={hasMore}
          loading={loading}
        />
          </>
        )}
      </div>
    </div>
  );
}