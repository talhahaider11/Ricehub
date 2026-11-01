import PostCard from "../posts/PostCard";

export default function ProfilePosts({
  posts,
  onDeleted,
  currentUser,
  hasMore,
  loadingMore,
  onLoadMore,
}) {
  return (
    <section className="profile-posts">
      <h2>Posts</h2>

      {posts.length === 0 ? (
        <div className="empty-state">
          No posts yet.
        </div>
      ) : (
        <>
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              currentUser={currentUser}
              onDeleted={onDeleted}
            />
          ))}
          {hasMore && (
            <button type="button" className="btn btn-secondary" onClick={onLoadMore} disabled={loadingMore}>
              {loadingMore ? "Loading..." : "Load more posts"}
            </button>
          )}
        </>
      )}
    </section>
  );
}