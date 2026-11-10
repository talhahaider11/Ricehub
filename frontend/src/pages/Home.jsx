import { motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
import StoryTray from "../components/stories/StoryTray";
import PostCard from "../components/posts/PostCard";
import InfiniteLoader from "../components/common/InfiniteLoader";
import PostSkeleton from "../components/common/PostSkeleton";
import ErrorState from "../components/common/ErrorState";
import EmptyState from "../components/common/EmptyState";
import FeedTabs from "../components/feed/FeedTabs";

import usePosts from "../hooks/usePosts";
import useAuth from "../hooks/useAuth";
import { useLanguage } from "../context/LanguageContext";

export default function Home() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const prefersReducedMotion = useReducedMotion();
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
  const postListVariants = {
    hidden: {},
    visible: {
      transition: prefersReducedMotion
        ? { duration: 0 }
        : { delayChildren: 0.04, staggerChildren: 0.075 },
    },
  };

  return (
    <div className="page-container">
      <div className="feed">
        <StoryTray currentUser={user} />
        <FeedTabs />
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
          <span>{t("feed")}</span>
          <select
            value={feedSort}
            onChange={(event) => setFeedSort(event.target.value)}
            aria-label={t("feedOrder")}
          >
            <option value="recent">{t("mostRecent")}</option>
            <option value="popular">{t("popular")}</option>
          </select>
        </label>

        {posts.length === 0 ? (
          <EmptyState
            title={t("noPostsYet")}
            message={t("feedWaitingForPosts")}
          />
        ) : (
          <motion.div
            className="feed-post-list"
            variants={postListVariants}
            initial={prefersReducedMotion ? false : "hidden"}
            animate={prefersReducedMotion ? undefined : "visible"}
          >
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                currentUser={user}
                trackView={false}
                onDeleted={removePost}
                onUpdated={updatePost}
              />
            ))}
          </motion.div>
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