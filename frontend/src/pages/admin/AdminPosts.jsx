import { useEffect, useState } from "react";
import ConfirmActionModal from "../../components/admin/ConfirmActionModal";
import ErrorState from "../../components/common/ErrorState";
import Loader from "../../components/common/Loader";
import adminService from "../../services/adminService";
import { getArrayResults } from "../../utils/arrayResults";

export default function AdminPosts() {
  const [query, setQuery] = useState("");
  const [posts, setPosts] = useState([]);
  const [selectedPost, setSelectedPost] = useState(null);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadPosts = async (event) => {
    event?.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await adminService.getPosts({ q: query.trim() });
      setPosts(getArrayResults(response, "Admin posts"));
    } catch (loadError) {
      console.error("Admin posts could not be loaded:", loadError);
      setError("Posts could not be loaded.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPosts();
  }, []);

  const deleteSelectedPost = async () => {
    if (!selectedPost || !reason.trim()) {
      setError("A deletion reason is required for the audit log.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await adminService.deletePost(selectedPost.id, reason.trim());
      setPosts((current) => current.filter((post) => post.id !== selectedPost.id));
      setSelectedPost(null);
      setReason("");
    } catch (deleteError) {
      console.error("Admin post could not be deleted:", deleteError);
      setError(deleteError.response?.data?.detail || "Post could not be deleted.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section>
      <header className="admin-page-heading">
        <div>
          <h1>Posts</h1>
          <p className="muted">Search content and remove policy-violating posts.</p>
        </div>
      </header>
      <form className="admin-filter-form" onSubmit={loadPosts}>
        <label>
          Search posts
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Post text or author" />
        </label>
        <button type="submit" className="btn btn-primary" disabled={loading}>Search</button>
      </form>
      {error && <p className="settings-error" role="alert">{error}</p>}
      {loading ? <Loader /> : error && !posts.length ? (
        <ErrorState message={error} onRetry={loadPosts} />
      ) : posts.length ? (
        <div className="admin-post-list">
          {posts.map((post) => (
            <article className="card admin-post-row" key={post.id}>
              <div>
                <strong>Post #{post.id} · @{post.author?.username || "unknown"}</strong>
                <p>{post.content || "Media post"}</p>
                <small>{new Date(post.created_at).toLocaleString()}</small>
              </div>
              <button type="button" className="btn btn-danger" onClick={() => setSelectedPost(post)}>
                Delete post
              </button>
            </article>
          ))}
        </div>
      ) : <p className="muted">No posts found.</p>}
      <ConfirmActionModal
        open={Boolean(selectedPost)}
        title="Delete post"
        message={`Delete post #${selectedPost?.id}? This action is permanent and audited.`}
        confirmLabel="Delete post"
        busy={saving}
        destructive
        onCancel={() => {
          if (!saving) {
            setSelectedPost(null);
            setReason("");
          }
        }}
        onConfirm={deleteSelectedPost}
      >
        <label>
          Audit reason
          <textarea value={reason} maxLength={2000} onChange={(event) => setReason(event.target.value)} />
        </label>
      </ConfirmActionModal>
    </section>
  );
}
