import { useEffect, useState } from "react";
import Modal from "../common/Modal";
import messageService from "../../services/messageService";
import Avatar from "../common/Avatar";
import VerifiedBadge from "../common/VerifiedBadge";
import useAuth from "../../hooks/useAuth";
import { getArrayResults } from "../../utils/arrayResults";
import { useLanguage } from "../../context/LanguageContext";
import UserLookupField from "./UserLookupField";

export default function CreateGroupModal({ open, onClose, onCreated }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [friends, setFriends] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return undefined;
    if (!user?.is_verified) {
      setFriends([]);
      setLoading(false);
      setError("Only verified users can create group conversations.");
      return undefined;
    }

    let active = true;
    setLoading(true);
    setError("");
    messageService.searchGroupMembers()
      .then((response) => {
        const users = getArrayResults(response, "Verified group members")
          .filter((member) => member.is_verified);
        if (active) setFriends(users);
      })
      .catch((loadError) => {
        console.error("Verified group members could not be loaded:", loadError);
        if (active) setError("Verified group members could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, user?.is_verified]);

  const toggleMember = (userId) => {
    setSelectedIds((current) => current.includes(userId)
      ? current.filter((id) => id !== userId)
      : [...current, userId]);
  };

  const addMemberId = (memberId) => {
    if (selectedIds.includes(memberId)) {
      setError(t("memberIdAlreadySelected"));
      return;
    }
    if (selectedIds.length >= 99) {
      setError(t("groupLimitError"));
      return;
    }
    setSelectedIds((current) => [...current, memberId]);
    setError("");
  };

  const createGroup = async (event) => {
    event.preventDefault();
    if (!user?.is_verified) {
      setError("Only verified users can create group conversations.");
      return;
    }
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
        <UserLookupField
          onSelect={addMemberId}
          disabled={creating || !user?.is_verified}
        />
        <fieldset>
          <legend>{t("selectFriends")}</legend>
          {loading && <p>{t("loadingFriends")}</p>}
          {!loading && user?.is_verified && friends.length === 0 && (
            <p>{t("noFriends")}</p>
          )}
          {friends.map((friend) => (
            <label className="group-friend-option" key={friend.id}>
              <input
                type="checkbox"
                checked={selectedIds.includes(friend.id)}
                onChange={() => toggleMember(friend.id)}
              />
              <Avatar user={friend} size="small" />
              <span>
                {friend.first_name || friend.username}
                <small>@{friend.username} · ID {friend.id}</small>
              </span>
              <VerifiedBadge verified={friend.is_verified} />
            </label>
          ))}
        </fieldset>
        <p className="group-member-hint">
          Select at least one other verified member. You are included automatically.
        </p>
        {selectedIds.length > 0 && (
          <p className="group-selected-members">
            {t("selectedMembers")}: {selectedIds.join(", ")}
          </p>
        )}
        {error && <p className="error" role="alert">{error}</p>}
        <button
          type="submit"
          disabled={
            creating
            || !user?.is_verified
            || !name.trim()
            || !selectedIds.length
          }
        >
          {creating ? t("creating") : t("createGroup")}
        </button>
      </form>
    </Modal>
  );
}
