import { useState } from "react";
import Avatar from "../common/Avatar";
import Modal from "../common/Modal";
import { useLanguage } from "../../context/LanguageContext";
import messageService from "../../services/messageService";
import UserLookupField from "./UserLookupField";

function getErrorMessage(error, fallback) {
  const data = error.response?.data;
  if (typeof data?.detail === "string") return data.detail;
  for (const field of ["user_id", "role", "admins_only", "is_muted"]) {
    const message = data?.[field];
    if (typeof message === "string") return message;
    if (Array.isArray(message) && typeof message[0] === "string") {
      return message[0];
    }
  }
  return fallback;
}

export default function GroupMemberModal({
  open,
  onClose,
  conversation,
  currentUser,
  onUpdated,
  onLeave,
}) {
  const { t, language } = useLanguage();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const members = conversation?.memberships?.length
    ? conversation.memberships.map((membership) => ({
      ...membership.user,
      role: membership.role,
    }))
    : (conversation?.participants || []).map((participant) => ({
      ...participant,
      role: "member",
    }));
  const currentMembership = members.find(
    (member) => String(member.id) === String(currentUser?.id)
  );
  const isAdmin = currentMembership?.role === "admin";
  const memberCount = conversation?.member_count ?? members.length;

  const performUpdate = async (action, fallbackKey) => {
    setSaving(true);
    setError("");
    try {
      const updatedConversation = await action();
      onUpdated(updatedConversation);
    } catch (actionError) {
      console.error("Group settings could not be updated:", actionError);
      setError(getErrorMessage(actionError, t(fallbackKey)));
    } finally {
      setSaving(false);
    }
  };

  const addMember = (memberId) => performUpdate(
    () => messageService.addGroupMember(conversation.id, memberId),
    "groupMemberAddFailed"
  );

  const changeRole = (member) => performUpdate(
    () => messageService.updateGroupMember(
      conversation.id,
      member.id,
      member.role === "admin" ? "member" : "admin"
    ),
    "groupMemberUpdateFailed"
  );

  const removeMember = (member) => {
    if (!window.confirm(t("groupRemoveMemberConfirm", {
      username: member.username,
    }))) return;
    return performUpdate(
      () => messageService.removeGroupMember(conversation.id, member.id),
      "groupMemberRemoveFailed"
    );
  };

  const updateAdminsOnly = (value) => performUpdate(
    () => messageService.updateGroupSettings(conversation.id, value),
    "groupSettingsFailed"
  );

  const toggleMute = () => performUpdate(
    () => messageService.muteConversation(conversation.id, !conversation.is_muted),
    "groupMuteFailed"
  );

  const leaveGroup = async () => {
    if (!window.confirm(t("confirmLeaveGroup"))) return;
    setSaving(true);
    setError("");
    try {
      await onLeave();
      onClose();
    } catch (leaveError) {
      console.error("Group could not be left:", leaveError);
      setError(getErrorMessage(leaveError, t("groupLeaveFailed")));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={conversation?.name || t("groupConversation")}
    >
      <div className="group-management">
        <p className="group-member-count">
          {t("groupMembersCount", {
            count: new Intl.NumberFormat(language).format(memberCount),
          })}
        </p>

        <button
          type="button"
          className="btn btn-secondary"
          disabled={saving}
          onClick={toggleMute}
        >
          {conversation?.is_muted ? t("unmute") : t("mute")}
        </button>

        {isAdmin && (
          <label className="group-admins-only-setting">
            <input
              type="checkbox"
              checked={Boolean(conversation?.admins_only)}
              disabled={saving}
              onChange={(event) => updateAdminsOnly(event.target.checked)}
            />
            <span>
              <strong>{t("groupAdminsOnly")}</strong>
              <small>{t("groupAdminsOnlyDescription")}</small>
            </span>
          </label>
        )}

        <h3>{t("groupMembers")}</h3>
        {isAdmin && memberCount < 100 && (
          <UserLookupField onSelect={addMember} disabled={saving} />
        )}

        <ul className="group-member-list">
          {members.map((member) => {
            const isCurrentUser = String(member.id) === String(currentUser?.id);
            return (
              <li className="group-member-item" key={member.id}>
                <Avatar user={member} size="small" />
                <span className="group-member-identity">
                  <strong>
                    {member.first_name || member.last_name
                      ? `${member.first_name || ""} ${member.last_name || ""}`.trim()
                      : `@${member.username}`}
                    {isCurrentUser ? ` (${t("you")})` : ""}
                  </strong>
                  <small>
                    {member.role === "admin"
                      ? t("groupAdminLabel")
                      : t("groupMemberLabel")}
                  </small>
                </span>
                {isAdmin && !isCurrentUser && (
                  <span className="group-member-actions">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={saving}
                      onClick={() => changeRole(member)}
                    >
                      {member.role === "admin"
                        ? t("groupDemoteAdmin")
                        : t("groupPromoteAdmin")}
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger"
                      disabled={saving}
                      onClick={() => removeMember(member)}
                    >
                      {t("groupRemoveMember")}
                    </button>
                  </span>
                )}
              </li>
            );
          })}
        </ul>

        {error && <p className="error" role="alert">{error}</p>}
        <button
          type="button"
          className="btn btn-danger"
          disabled={saving}
          onClick={leaveGroup}
        >
          {t("groupLeave")}
        </button>
      </div>
    </Modal>
  );
}
