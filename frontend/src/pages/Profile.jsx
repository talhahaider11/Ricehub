import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import userService from "../services/userService";
import postService from "../services/postService";
import Avatar from "../components/common/Avatar";
import Loader from "../components/common/Loader";
import Button from "../components/common/Button";
import ErrorState from "../components/common/ErrorState";
import FriendsList from "../components/friends/FriendList";
import ProfilePosts from "../components/profile/ProfilePosts";
import StoryStrip from "../components/stories/StoryStrip";
import friendService from "../services/friendService";
import messageService from "../services/messageService";
import settingsService from "../services/settingsService";
import useAuth from "../hooks/useAuth";
import { getArrayResults } from "../utils/arrayResults";
import { getMediaUrl } from "../utils/constants";

export default function Profile() {
  const { id } = useParams();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [postsPage, setPostsPage] = useState(1);
  const [hasMorePosts, setHasMorePosts] = useState(false);
  const [loadingMorePosts, setLoadingMorePosts] = useState(false);
  const [loading, setLoading] = useState(true);
  const [postsLoading, setPostsLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [friends, setFriends] = useState([]);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("spam");
  const [reportDetails, setReportDetails] = useState("");

  const isOwnProfile = String(currentUser?.id) === String(id);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setPostsLoading(true);
    setError("");
    setUser(null);

    Promise.all([
      userService.getUser(id),
      postService.list(1, "recent", id),
    ])
      .then(([profile, postsData]) => {
        if (!active) return;
        setUser(profile);
        setPosts(getArrayResults(postsData, "Profile posts"));
        setPostsPage(1);
        setHasMorePosts(Boolean(postsData.next));
      })
      .catch((loadError) => {
        console.error("Profile could not be loaded:", loadError);
        if (active) setError("This profile could not be loaded.");
      })
      .finally(() => {
        if (active) {
          setLoading(false);
          setPostsLoading(false);
        }
      });

    return () => { active = false; };
  }, [id]);

  useEffect(() => {
    if (isOwnProfile || !user) return;
    settingsService.isMuted(user.id)
      .then(setMuted)
      .catch((loadError) => {
        console.error("Mute status could not be loaded:", loadError);
      });
  }, [isOwnProfile, user]);

  const addFriend = async () => {
    try {
      setActionLoading(true);
      setActionMessage("");
      await friendService.send(user.id);
      setRequestSent(true);
      setActionMessage("Friend request sent.");
    } catch (requestError) {
      setActionMessage(
        requestError.response?.data?.detail || "Friend request could not be sent."
      );
    } finally {
      setActionLoading(false);
    }
  };

  const startConversation = async () => {
    try {
      setActionLoading(true);
      const conversation = await messageService.createConversation(user.username);
      navigate("/messages", { state: { conversationId: conversation.id } });
    } catch (conversationError) {
      setActionMessage(
        conversationError.response?.data?.detail || "Conversation could not be opened."
      );
    } finally {
      setActionLoading(false);
    }
  };

  const toggleMute = async () => {
    try {
      setActionLoading(true);
      if (muted) {
        await settingsService.unmuteUser(user.id);
        setMuted(false);
        setActionMessage("Account unmuted.");
      } else {
        await settingsService.muteUser(user.id);
        setMuted(true);
        setActionMessage("Account muted. Their posts and stories are hidden from your feed.");
      }
    } catch (muteError) {
      setActionMessage(muteError.response?.data?.detail || "Mute setting could not be updated.");
    } finally {
      setActionLoading(false);
    }
  };

  const blockUser = async () => {
    if (!window.confirm(`Block @${user.username}?`)) return;
    try {
      setActionLoading(true);
      await settingsService.blockUser(user.username);
      navigate("/", { replace: true });
    } catch (blockError) {
      setActionMessage(blockError.response?.data?.detail || "Account could not be blocked.");
      setActionLoading(false);
    }
  };

  const submitReport = async (event) => {
    event.preventDefault();
    try {
      setActionLoading(true);
      const result = await settingsService.reportAccount({
        user_id: user.id,
        reason: reportReason,
        details: reportDetails,
      });
      setActionMessage(result.detail);
      setReportOpen(false);
      setReportDetails("");
    } catch (reportError) {
      setActionMessage(reportError.response?.data?.detail || "Report could not be submitted.");
    } finally {
      setActionLoading(false);
    }
  };

  const openFriends = async () => {
    if (!isOwnProfile) return;
    try {
      const data = await friendService.list();
      setFriends(getArrayResults(data, "Friends"));
      setFriendsOpen(true);
    } catch (friendsError) {
      setActionMessage(friendsError.response?.data?.detail || "Friends could not be loaded.");
    }
  };

  const loadMorePosts = async () => {
    if (loadingMorePosts || !hasMorePosts) return;
    setLoadingMorePosts(true);
    try {
      const nextPage = postsPage + 1;
      const data = await postService.list(nextPage, "recent", id);
      setPosts((current) => [...current, ...getArrayResults(data, "Profile posts")]);
      setPostsPage(nextPage);
      setHasMorePosts(Boolean(data.next));
    } catch (loadError) {
      setActionMessage(loadError.response?.data?.detail || "More posts could not be loaded.");
    } finally {
      setLoadingMorePosts(false);
    }
  };

  if (loading) return <Loader />;
  if (!user) {
    return error
      ? <ErrorState message={error} />
      : <div className="empty-state">Profile unavailable.</div>;
  }

  return (
    <div className="page-container profile-page">
      <div className="card profile-header">
        <div className="cover-image">
          {user.cover_picture && <img src={getMediaUrl(user.cover_picture)} alt="" />}
        </div>
        <div className="profile-main">
          <Avatar user={user} size="large" />
          <div className="profile-main-info">
            <h1>{[user.first_name, user.last_name].filter(Boolean).join(" ") || user.username}</h1>
            <p>@{user.username}</p>
            <div className="profile-stats">
              <span><strong>{user.posts_count || posts.length}</strong> Posts</span>
              {isOwnProfile ? (
                <button type="button" onClick={openFriends}>
                  <strong>{user.friends_count || 0}</strong> Friends
                </button>
              ) : (
                <span><strong>{user.friends_count || 0}</strong> Friends</span>
              )}
            </div>
          </div>
          {isOwnProfile ? (
            <Link to="/profile/edit"><Button variant="secondary">Edit Profile</Button></Link>
          ) : (
            <div className="profile-actions">
              <Button onClick={addFriend} disabled={actionLoading || requestSent}>
                {requestSent ? "Request Sent" : "Add Friend"}
              </Button>
              <details className="profile-options">
                <summary aria-label="More profile actions">More</summary>
                <div role="menu">
                  <button type="button" role="menuitem" onClick={startConversation}>
                    Direct Message
                  </button>
                  <button type="button" role="menuitem" onClick={() => setReportOpen(true)}>
                    Report about this account
                  </button>
                  <button type="button" role="menuitem" onClick={blockUser} disabled={actionLoading}>
                    Block this account
                  </button>
                  <button type="button" role="menuitem" onClick={toggleMute} disabled={actionLoading}>
                    {muted ? "Unmute this account" : "Mute this account"}
                  </button>
                </div>
              </details>
            </div>
          )}
        </div>
      </div>

      {actionMessage && <p className="form-message" role="status">{actionMessage}</p>}

      <div className="card profile-info">
        <h2>About</h2>
        <p>{user.bio || "No bio added yet."}</p>
      </div>

      <StoryStrip
        currentUser={currentUser}
        onlyUserId={user.id}
        showCreate={isOwnProfile}
      />
      {postsLoading
        ? <Loader />
        : <ProfilePosts posts={posts} currentUser={currentUser} hasMore={hasMorePosts} loadingMore={loadingMorePosts} onLoadMore={loadMorePosts} onDeleted={(postId) => {
          setPosts((current) => current.filter((post) => post.id !== postId));
        }} />}

      {friendsOpen && (
        <div className="profile-modal-backdrop" role="presentation" onClick={() => setFriendsOpen(false)}>
          <section
            className="profile-modal card"
            role="dialog"
            aria-modal="true"
            aria-label="Your friends"
            onClick={(event) => event.stopPropagation()}
          >
            <button type="button" className="profile-modal-close" onClick={() => setFriendsOpen(false)}>
              Close
            </button>
            <h2>Friends ({friends.length})</h2>
            <FriendsList friends={friends} />
          </section>
        </div>
      )}

      {reportOpen && (
        <div className="profile-modal-backdrop" role="presentation" onClick={() => setReportOpen(false)}>
          <form className="profile-modal card" role="dialog" aria-modal="true" aria-label="Report account" onSubmit={submitReport} onClick={(event) => event.stopPropagation()}>
            <button type="button" className="profile-modal-close" onClick={() => setReportOpen(false)}>Cancel</button>
            <h2>Report @{user.username}</h2>
            <label>
              Reason
              <select value={reportReason} onChange={(event) => setReportReason(event.target.value)}>
                <option value="spam">Spam</option>
                <option value="harassment">Harassment</option>
                <option value="impersonation">Impersonation</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label>
              Details
              <textarea value={reportDetails} onChange={(event) => setReportDetails(event.target.value)} maxLength={2000} />
            </label>
            <Button type="submit" disabled={actionLoading}>{actionLoading ? "Submitting..." : "Submit report"}</Button>
          </form>
        </div>
      )}
    </div>
  );
}
