import PostCard from "../posts/PostCard";

export default function ProfilePosts({
  posts,
  onDeleted,
}) {
  return (
    <section className="profile-posts">
      <h2>Posts</h2>

      {posts.length === 0 ? (
        <div className="empty-state">
          No posts yet.
        </div>
      ) : (
        posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            onDeleted={onDeleted}
          />
        ))
      )}
    </section>
  );
}