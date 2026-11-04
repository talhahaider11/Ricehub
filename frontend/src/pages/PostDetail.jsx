import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import ErrorState from "../components/common/ErrorState";
import Loader from "../components/common/Loader";
import PostCard from "../components/posts/PostCard";
import useAuth from "../hooks/useAuth";
import postService from "../services/postService";

export default function PostDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    postService
      .get(id)
      .then((result) => {
        if (active) setPost(result);
      })
      .catch((loadError) => {
        console.error("Post could not be loaded:", loadError);
        if (active) setError("This post could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id]);

  if (loading) return <Loader />;
  if (error) return <ErrorState message={error} onRetry={() => navigate(0)} />;
  if (!post) return null;

  return (
    <div className="page-container">
      <div className="feed">
        <PostCard
          post={post}
          currentUser={user}
          onDeleted={() => navigate("/")}
          onUpdated={setPost}
        />
      </div>
    </div>
  );
}
