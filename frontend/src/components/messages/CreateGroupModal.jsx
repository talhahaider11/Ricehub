import { useEffect, useState } from "react";
import Modal from "../common/Modal";
import friendService from "../../services/friendService";
import messageService from "../../services/messageService";
import { getArrayResults } from "../../utils/arrayResults";

export default function CreateGroupModal({ open, onClose, onCreated }) {
  const [friends, setFriends] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return undefined;
    let active = true;
    setLoading(true);
    setError("");
    friendService.list()
      .then((response) => {
        const users = getArrayResults(response, "Friends");
        if (active) setFriends(users);
      })
      .catch((loadError) => {
        console.error("Friends could not be loaded for group creation:", loadError);
        if (active) setError("Friends could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open]);

  const toggleMember = (userId) => {
    setSelectedIds((current) => current.includes(userId)
      ? current.filter((id) => id !== userId)
      : [...current, userId]);
  };

  const createGroup = async (event) => {
    event.preventDefault();
    if (!name.trim() || !selectedIds.length || creating) return;
    setCreating(true);
    setError("");
    try {
      const conversation = await messageService.createGroup(
        name.trim(),
        selectedIds
      );
      setName("");
      setSelectedIds([]);
      onCreated(conversation);
    } catch (createError) {
      console.error("Group conversation could not be created:", createError);
      const responseData = createError.response?.data;
      const memberError = responseData?.user_ids;
      setError(typeof responseData?.detail === "string"
        ? responseData.detail
        : Array.isArray(memberError)
          ? memberError[0]
          : typeof memberError === "string"
            ? memberError
            : "Group conversation could not be created.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Create group conversation">
      <form className="create-group-form" onSubmit={createGroup}>
        <label>
          Group name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={100}
            required
          />
        </label>
        <fieldset>
          <legend>Select friends</legend>
          {loading && <p>Loading friends...</p>}
          {!loading && friends.length === 0 && <p>No friends available.</p>}
          {friends.map((friend) => (
            <label className="group-friend-option" key={friend.id}>
              <input
                type="checkbox"
                checked={selectedIds.includes(friend.id)}
                onChange={() => toggleMember(friend.id)}
              />
              <span>@{friend.username}</span>
            </label>
          ))}
        </fieldset>
        {error && <p className="error" role="alert">{error}</p>}
        <button
          type="submit"
          disabled={loading || creating || !name.trim() || !selectedIds.length}
        >
          {creating ? "Creating..." : "Create group"}
        </button>
      </form>
    </Modal>
  );
}
