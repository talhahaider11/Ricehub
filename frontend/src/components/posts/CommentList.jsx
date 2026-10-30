import { useEffect, useState } from "react";
import postService from "../../services/postService";
import Avatar from "../common/Avatar";
import Loader from "../common/Loader";
import ErrorState from "../common/ErrorState";
import { getArrayResults } from "../../utils/arrayResults";

export default function CommentList({
  postId,
  refreshKey = 0,
}) {
  const [comments, setComments] =
    useState([]);

  const [loading, setLoading] =
    useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");

    postService
      .comments(postId)
      .then((data) => {
        if (!mounted) return;

        setComments(getArrayResults(data, "Comments"));
      })
      .catch((loadError) => {
        console.error("Comments could not be loaded:", loadError);
        if (mounted) setError("Comments could not be loaded.");
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [postId, refreshKey]);

  if (loading) {
    return <Loader />;
  }

  if (error) {
    return <ErrorState message={error} />;
  }

  return (
    <div className="comment-list">
      {comments.map((comment) => (
        <div
          className="comment"
          key={comment.id}
        >
          <Avatar
            user={comment.author}
            size="small"
          />

          <div className="comment-body">
            <strong>
              {comment.author?.username || "User"}
            </strong>

            <p>
              {comment.content}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}