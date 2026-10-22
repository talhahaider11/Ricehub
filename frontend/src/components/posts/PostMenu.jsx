import { useState } from "react";

import postService from "../../services/postService";
import Modal from "../common/Modal";

export default function PostMenu({
  post,
  currentUser,
  onDeleted,
  onUpdated,
}) {
  const [open, setOpen] =
    useState(false);

  const [editing, setEditing] =
    useState(false);

  const [content, setContent] =
    useState(post.content || "");

  const [loading, setLoading] =
    useState(false);

  const isOwner =
    String(post.author?.id) ===
    String(currentUser?.id);

  if (!isOwner) {
    return null;
  }

  const update = async () => {
    try {
      setLoading(true);

      const updated =
        await postService.update(
          post.id,
          { content }
        );

      onUpdated?.(updated);

      setEditing(false);
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const remove = async () => {
    const confirmed =
      window.confirm(
        "Delete this post?"
      );

    if (!confirmed) return;

    try {
      setLoading(true);

      await postService.remove(
        post.id
      );

      onDeleted?.(post.id);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        className="post-menu-button"
        onClick={() =>
          setOpen(!open)
        }
      >
        •••
      </button>

      {open && (
        <div className="post-menu">

          <button
            onClick={() =>
              setEditing(true)
            }
          >
            Edit post
          </button>

          <button
            onClick={remove}
            disabled={loading}
          >
            Delete post
          </button>

        </div>
      )}

      {editing && (
        <Modal
          open={editing}
          onClose={() =>
            setEditing(false)
          }
          title="Edit post"
        >
          <textarea
            className="edit-post-textarea"
            value={content}
            onChange={(event) =>
              setContent(
                event.target.value
              )
            }
          />

          <button
            className="btn btn-primary"
            onClick={update}
            disabled={loading}
          >
            {loading
              ? "Saving..."
              : "Save"}
          </button>
        </Modal>
      )}
    </>
  );
}