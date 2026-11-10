import { useEffect, useState } from "react";
import Modal from "../common/Modal";
import friendService from "../../services/friendService";
import messageService from "../../services/messageService";
import { getArrayResults } from "../../utils/arrayResults";
import { useLanguage } from "../../context/LanguageContext";
import { parseUserId } from "../../utils/userId";

export default function CreateGroupModal({ open, onClose, onCreated }) {
  const { t } = useLanguage();
  const [friends, setFriends] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [userId, setUserId] = useState("");
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
        if (active) setError(t("friendsLoadFailed"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, t]);

  const toggleMember = (userId) => {
    setSelectedIds((current) => current.includes(userId)
      ? current.filter((id) => id !== userId)
      : [...current, userId]);
  };

  const addUserId = () => {
    const parsedId = parseUserId(userId);
    if (parsedId === null) {
      setError(t("enterValidUserId"));
      return;
    }
    if (selectedIds.includes(parsedId)) {
      setError(t("memberIdAlreadySelected"));
      return;
    }
    if (selectedIds.length >= 99) {
      setError(t("groupLimitError"));
      return;
    }
    setSelectedIds((current) => [...current, parsedId]);
    setUserId("");
    setError("");
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
      setUserId("");
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
            : t("groupConversationCreateFailed"));
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={t("createGroupConversation")}>
      <form className="create-group-form" onSubmit={createGroup}>
        <label>
          {t("groupName")}
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={100}
            required
          />
        </label>
        <div className="group-user-id-field">
          <label htmlFor="create-group-user-id">{t("userId")}</label>
          <div>
            <input
              id="create-group-user-id"
              inputMode="numeric"
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
              placeholder={t("userId")}
            />
            <button type="button" onClick={addUserId}>{t("addUserId")}</button>
          </div>
        </div>
        <fieldset>
          <legend>{t("selectFriends")}</legend>
          {loading && <p>{t("loadingFriends")}</p>}
          {!loading && friends.length === 0 && <p>{t("noFriends")}</p>}
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
        {selectedIds.length > 0 && (
          <p className="group-selected-members">
            {t("selectedMembers")}: {selectedIds.join(", ")}
          </p>
        )}
        {error && <p className="error" role="alert">{error}</p>}
        <button
          type="submit"
          disabled={creating || !name.trim() || !selectedIds.length}
        >
          {creating ? t("creating") : t("createGroup")}
        </button>
      </form>
    </Modal>
  );
}
