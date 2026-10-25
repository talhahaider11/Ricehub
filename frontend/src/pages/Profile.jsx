import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import userService from "../services/userService";
import Avatar from "../components/common/Avatar";
import Loader from "../components/common/Loader";
import Button from "../components/common/Button";
import ErrorState from "../components/common/ErrorState";
import friendService from "../services/friendService";
import messageService from "../services/messageService";
import useAuth from "../hooks/useAuth";
import { getMediaUrl } from "../utils/constants";

export default function Profile() {
  const { id } = useParams();
  const { user: currentUser } =
    useAuth();
  const navigate = useNavigate();

  const [user, setUser] =
    useState(null);

  const [loading, setLoading] =
    useState(true);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [requestSent, setRequestSent] = useState(false);

  const isOwnProfile =
    String(currentUser?.id) ===
    String(id);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setUser(null);

    userService
      .getUser(id)
      .then((profile) => {
        if (active) setUser(profile);
      })
      .catch(() => {
        if (active) setError("This profile could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id]);

  const addFriend = async () => {
    try {
      setActionLoading(true);
      setActionMessage("");
      await friendService.send(user.id);
      setRequestSent(true);
      setActionMessage("Friend request sent.");
    } catch (requestError) {
      setActionMessage(
        requestError.response?.data?.detail ||
          "Friend request could not be sent."
      );
    } finally {
      setActionLoading(false);
    }
  };

  const startConversation = async () => {
    try {
      setActionLoading(true);
      const conversation = await messageService.createConversation(user.username);
      navigate("/messages", {
        state: { conversationId: conversation.id },
      });
    } catch (conversationError) {
      setActionMessage(
        conversationError.response?.data?.detail ||
          "Conversation could not be opened."
      );
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return <Loader />;
  }

  if (!user) {
    if (error) {
      return <ErrorState message={error} />;
    }

    return (
      <div className="empty-state">
        Profile unavailable.
      </div>
    );
  }

  return (
    <div className="page-container">

      <div className="card profile-header">

        <div className="cover-image">
          {user.cover_picture && (
            <img
              src={getMediaUrl(user.cover_picture)}
              alt=""
            />
          )}
        </div>

        <div className="profile-main">

          <Avatar
            user={user}
            size="large"
          />

          <div>
            <h1>
              {[user.first_name, user.last_name].filter(Boolean).join(" ") ||
                user.username}
            </h1>

            <p>
              @{user.username}
            </p>
          </div>

          {isOwnProfile && (
            <Link to="/profile/edit">
              <Button variant="secondary">
                Edit Profile
              </Button>
            </Link>
          )}
          {!isOwnProfile && (
            <div className="profile-actions">
              <Button
                onClick={addFriend}
                disabled={actionLoading || requestSent}
              >
                {requestSent ? "Request Sent" : "Add Friend"}
              </Button>
              <Button
                variant="secondary"
                onClick={startConversation}
                disabled={actionLoading}
              >
                Message
              </Button>
            </div>
          )}

        </div>

      </div>

      {actionMessage && (
        <p className="form-message" role="status">
          {actionMessage}
        </p>
      )}

      <div className="card profile-info">
        <h2>About</h2>

        <p>
          {user.bio ||
            "No bio added yet."}
        </p>
      </div>

    </div>
  );
}