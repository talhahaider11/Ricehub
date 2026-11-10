import { useState } from "react";
import Modal from "../common/Modal";
import messageService from "../../services/messageService";
import { useLanguage } from "../../context/LanguageContext";
import { parseUserId } from "../../utils/userId";

export default function GroupMemberModal({
  open,
  onClose,
  conversation,
  currentUser,
  onUpdated,
}) {
  const { t } = useLanguage();
  const [userId, setUserId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const addMember = async (event) => {
    event.preventDefault();
    const parsedId = parseUserId(userId);
    if (parsedId === null) {
      setError(t("enterValidUserId"));
      return;
    }

    setSaving(true);
    setError("");
    try {
      const updatedConversation = await messageService.addGroupMember(
        conversation.id,
        parsedId
      );
      onUpdated(updatedConversation);
      setUserId("");
    } catch (addError) {
      console.error("Group member could not be added:", addError);
      const userError = addError.response?.data?.user_id;
      setError(
        typeof addError.response?.data?.detail === "string"
          ? addError.response.data.detail
          : Array.isArray(userError)
            ? userError[0]
            : typeof userError === "string"
              ? userError
              : t("groupMemberAddFailed")
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={t("groupAddMember")}>
      <form className="group-user-id-form" onSubmit={addMember}>
        <label htmlFor="group-member-user-id">{t("userId")}</label>
        <div>
          <input
            id="group-member-user-id"
            inputMode="numeric"
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            placeholder={t("userId")}
            required
          />
          <button type="submit" disabled={saving}>
            {saving ? t("addingMember") : t("addMember")}
          </button>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
      </form>
      <ul className="group-member-list">
        {conversation?.participants?.map((participant) => (
          <li key={participant.id}>
            @{participant.username}
            {String(participant.id) === String(currentUser?.id)
              ? ` (${t("you")})`
              : ""}
          </li>
        ))}
      </ul>
    </Modal>
  );
}
