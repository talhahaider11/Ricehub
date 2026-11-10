import { useState } from "react";
import Modal from "../common/Modal";
import messageService from "../../services/messageService";
import { useLanguage } from "../../context/LanguageContext";
import UserLookupField from "./UserLookupField";

export default function GroupMemberModal({
  open,
  onClose,
  conversation,
  currentUser,
  onUpdated,
}) {
  const { t } = useLanguage();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const addMember = async (memberId) => {
    setSaving(true);
    setError("");
    try {
      const updatedConversation = await messageService.addGroupMember(
        conversation.id,
        memberId
      );
      onUpdated(updatedConversation);
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
      <UserLookupField onSelect={addMember} disabled={saving} />
      {error && <p className="error" role="alert">{error}</p>}
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
