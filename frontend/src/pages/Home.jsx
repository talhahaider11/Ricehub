import { useState } from "react";
import CreatePost from "../components/posts/CreatePost";
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
    addPost,
    removePost,
    updatePost,
  } = usePosts(feedSort);

  // Loading - first load
  if (loading && posts.length === 0) {
    return (
      <div className="page-container">
        <div className="feed">
          <PostSkeleton />
          <PostSkeleton />
          <PostSkeleton />
        </div>
      </div>
    );
  }

  // Error
  if (error && posts.length === 0) {
    return (
      <div className="page-container">
        <ErrorState message={error} onRetry={loadPosts} />
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="feed">
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
        <CreatePost onCreated={addPost} />

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
      </div>
    </div>
  );
}