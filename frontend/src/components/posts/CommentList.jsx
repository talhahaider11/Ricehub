import { useEffect, useState } from "react";
import postService from "../../services/postService";
import Avatar from "../common/Avatar";
import Loader from "../common/Loader";

export default function CommentList({
  postId,
}) {
  const [comments, setComments] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    let mounted = true;

    postService
      .comments(postId)
      .then((data) => {
        if (!mounted) return;

        setComments(
          data.results || data
        );
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [postId]);

  if (loading) {
    return <Loader />;
  }

  return (
    <div className="comment-list">
      {comments.map((comment) => (
        <div
          className="comment"
          key={comment.id}
        >
          <Avatar
            user={comment.user}
            size="small"
          />

          <div className="comment-body">
            <strong>
              {comment.user?.username}
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