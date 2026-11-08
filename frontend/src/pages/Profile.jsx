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
  const [friendshipStatus, setFriendshipStatus] = useState("none");
  const [friendRequestId, setFriendRequestId] = useState(null);
  const [friends, setFriends] = useState([]);
  const [friendsOpen, setFriendsOpen] = useState(false);

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
        setFriendshipStatus(profile.friendship_status || "none");
        setFriendRequestId(profile.friend_request_id || null);
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
    if (isOwnProfile || !user) return undefined;
    const refreshFriendship = async () => {
      try {
        const profile = await userService.getUser(id);
        setFriendshipStatus(profile.friendship_status || "none");
        setFriendRequestId(profile.friend_request_id || null);
      } catch (refreshError) {
        console.error("Friendship status could not be refreshed:", refreshError);
      }
    };
    window.addEventListener("focus", refreshFriendship);
    return () => window.removeEventListener("focus", refreshFriendship);
  }, [id, isOwnProfile, user]);

  const addFriend = async () => {
    try {
      setActionLoading(true);
      setActionMessage("");
      if (friendshipStatus === "incoming_pending" && friendRequestId) {
        await friendService.accept(friendRequestId);
        setFriendshipStatus("friends");
        setFriendRequestId(null);
        setUser((current) => (
          current ? { ...current, friends_count: (current.friends_count || 0) + 1 } : current
        ));
        setActionMessage("Friend request accepted.");
      } else {
        const request = await friendService.send(user.id);
        setFriendshipStatus(request.status === "accepted" ? "friends" : "outgoing_pending");
        setActionMessage(request.status === "accepted" ? "You are now friends." : "Friend request sent.");
      }
    } catch (requestError) {
      setActionMessage(
        requestError.response?.data?.detail || "Friend request could not be sent."
      );
    } finally {
      setActionLoading(false);
    }
  };

  const cancelFriendRequest = async () => {
    if (!friendRequestId) {
      setActionMessage("Friend request could not be found. Refresh the profile and try again.");
      return;
    }

    try {
      setActionLoading(true);
      setActionMessage("");
      await friendService.cancel(friendRequestId);
      setFriendshipStatus("none");
      setFriendRequestId(null);
      setActionMessage("Friend request cancelled.");
    } catch (requestError) {
      setActionMessage(
        requestError.response?.data?.detail || "Friend request could not be cancelled."
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

  const moreActions = async (action) => {
    if (action === "message") {
      await startConversation();
      return;
    }
    await blockUser();
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
              <Button
                onClick={friendshipStatus === "outgoing_pending" ? cancelFriendRequest : addFriend}
                disabled={actionLoading || friendshipStatus === "friends"}
              >
                {friendshipStatus === "friends"
                  ? "Friends"
                  : friendshipStatus === "outgoing_pending"
                    ? "Cancel request"
                    : friendshipStatus === "incoming_pending"
                      ? "Accept request"
                      : "Add Friend"}
              </Button>
              <details className="profile-options">
                <summary aria-label="More profile actions">More</summary>
                <div role="menu">
                  <button type="button" role="menuitem" onClick={() => void moreActions("message")}>
                    Send message
                  </button>
                  <button type="button" role="menuitem" onClick={() => void moreActions("block")} disabled={actionLoading}>
                    Block
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

    </div>
  );
}
