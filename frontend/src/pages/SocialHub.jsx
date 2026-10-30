import { useCallback, useEffect, useState } from "react";
import communityService from "../services/communityService";
import useAuth from "../hooks/useAuth";
import friendService from "../services/friendService";
import { getMediaUrl } from "../utils/constants";
import { getArrayResults } from "../utils/arrayResults";

const tabs = ["Stories", "Groups & Pages", "Events", "Marketplace"];

function localDateTime(value) {
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

export default function SocialHub() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(tabs[0]);
  const [stories, setStories] = useState([]);
  const [communities, setCommunities] = useState([]);
  const [events, setEvents] = useState([]);
  const [listings, setListings] = useState([]);
  const [friends, setFriends] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [orders, setOrders] = useState([]);
  const [expandedCommunityId, setExpandedCommunityId] = useState(null);
  const [communityPosts, setCommunityPosts] = useState([]);
  const [communityPostText, setCommunityPostText] = useState("");
  const [storyViewers, setStoryViewers] = useState({});
  const [viewedStories, setViewedStories] = useState({});
  const [inviteSelection, setInviteSelection] = useState({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [storyText, setStoryText] = useState("");
  const [storyMedia, setStoryMedia] = useState(null);
  const [communityName, setCommunityName] = useState("");
  const [communityDescription, setCommunityDescription] = useState("");
  const [communityKind, setCommunityKind] = useState("group");
  const [eventTitle, setEventTitle] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [editingEventId, setEditingEventId] = useState(null);
  const [listingTitle, setListingTitle] = useState("");
  const [listingDescription, setListingDescription] = useState("");
  const [listingPrice, setListingPrice] = useState("");
  const [listingLocation, setListingLocation] = useState("");
  const [listingImage, setListingImage] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [storyData, communityData, eventData, listingData, friendData, invitationData, orderData] = await Promise.all([
        communityService.stories(),
        communityService.communities(),
        communityService.events(),
        communityService.listings(search),
        friendService.list(),
        communityService.invitations(),
        communityService.orders(),
      ]);
      setStories(getArrayResults(storyData, "Stories"));
      setCommunities(getArrayResults(communityData, "Communities"));
      setEvents(getArrayResults(eventData, "Events"));
      setListings(getArrayResults(listingData, "Marketplace listings"));
      setFriends(getArrayResults(friendData, "Friends"));
      setInvitations(getArrayResults(invitationData, "Event invitations"));
      setOrders(getArrayResults(orderData, "Marketplace orders"));
    } catch (loadError) {
      console.error("Community features could not be loaded:", loadError);
      setError(loadError.response?.data?.detail || "Community features could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [search]);

  const loadCommunityPosts = async (communityId) => {
    setError("");
    try {
      const data = await communityService.communityPosts(communityId);
      setCommunityPosts(getArrayResults(data, "Community posts"));
      setExpandedCommunityId(communityId);
    } catch (loadError) {
      console.error("Community posts could not be loaded:", loadError);
      setError(loadError.response?.data?.detail || "Community posts could not be loaded.");
    }
  };

  useEffect(() => {
    load();
  }, [load]);

  const perform = async (action, successMessage) => {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await action();
      setNotice(successMessage);
      await load();
    } catch (actionError) {
      const detail = actionError.response?.data?.detail;
      setError(
        typeof detail === "string"
          ? detail
          : "That action could not be completed. Check the form and try again."
      );
    } finally {
      setSaving(false);
    }
  };

  const createStory = (event) => {
    event.preventDefault();
    const data = new FormData();
    data.append("text", storyText);
    if (storyMedia) data.append("media", storyMedia);
    return perform(async () => {
      await communityService.createStory(data);
      setStoryText("");
      setStoryMedia(null);
    }, "Your story is live for 24 hours.");
  };

  const createCommunity = (event) => {
    event.preventDefault();
    return perform(async () => {
      await communityService.createCommunity({
        name: communityName,
        kind: communityKind,
        description: communityDescription,
        visibility: "public",
      });
      setCommunityName("");
      setCommunityDescription("");
    }, `${communityKind === "group" ? "Group" : "Page"} created.`);
  };

  const createEvent = (event) => {
    event.preventDefault();
    return perform(async () => {
      await communityService.createEvent({
        title: eventTitle,
        description: eventDescription,
        location: eventLocation,
        starts_at: new Date(eventDate).toISOString(),
      });
      setEventTitle("");
      setEventDescription("");
      setEventLocation("");
      setEventDate("");
    }, "Event created.");
  };

  const createListing = (event) => {
    event.preventDefault();
    const data = new FormData();
    data.append("title", listingTitle);
    data.append("description", listingDescription);
    data.append("price", listingPrice);
    data.append("location", listingLocation);
    if (listingImage) data.append("image", listingImage);
    return perform(async () => {
      await communityService.createListing(data);
      setListingTitle("");
      setListingDescription("");
      setListingPrice("");
      setListingLocation("");
      setListingImage(null);
    }, "Your listing is now available.");
  };

  return (
    <div className="page-container social-hub">
      <header className="page-heading">
        <div>
          <h1>Discover RiceHub</h1>
          <p>Stories, communities, events and local listings.</p>
        </div>
      </header>
      {error && <p className="settings-error" role="alert">{error}</p>}
      {notice && <p className="settings-status" role="status">{notice}</p>}
      <div className="social-tabs" role="tablist" aria-label="Discover sections">
        {tabs.map((tab) => (
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            className={activeTab === tab ? "active" : ""}
            key={tab}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "Stories" && (
        <section className="social-section">
          <form className="card social-form" onSubmit={createStory}>
            <h2>Share a story</h2>
            <textarea value={storyText} onChange={(e) => setStoryText(e.target.value)} maxLength={500} placeholder="Add a short update" />
            <label>Image or video (up to 20 MB)<input type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" onChange={(e) => setStoryMedia(e.target.files?.[0] || null)} /></label>
            <button className="btn btn-primary" disabled={saving || (!storyText.trim() && !storyMedia)}>Share story</button>
          </form>
          <div className="social-grid">
            {stories.map((story) => (
              <article className="card social-card" key={story.id}>
                <strong>@{story.author.username}</strong>
                {(story.author.id === user?.id || viewedStories[story.id]) && story.text && <p>{story.text}</p>}
                {(story.author.id === user?.id || viewedStories[story.id]) && story.media && (/\.(mp4|webm)$/i.test(story.media)
                  ? <video src={getMediaUrl(story.media)} controls playsInline />
                  : <img src={getMediaUrl(story.media)} alt="Story" />)}
                <small>Expires {new Date(story.expires_at).toLocaleString()} · {story.view_count} views</small>
                {story.author.id !== user?.id && (
                  <button className="btn btn-secondary" disabled={saving || viewedStories[story.id]} onClick={() => perform(async () => {
                    await communityService.viewStory(story.id);
                    setViewedStories((current) => ({ ...current, [story.id]: true }));
                  }, "Story opened.")}>{viewedStories[story.id] ? "Viewed" : "View story"}</button>
                )}
                {story.author.id === user?.id && (
                  <div className="social-actions">
                      <button className="btn btn-secondary" onClick={async () => {
                        try {
                          const viewers = await communityService.storyViewers(story.id);
                          setStoryViewers((current) => ({
                            ...current,
                            [story.id]: getArrayResults(viewers, "Story viewers"),
                          }));
                        } catch (viewerError) {
                          console.error("Story viewers could not be loaded:", viewerError);
                          setError(viewerError.response?.data?.detail || "Story viewers could not be loaded.");
                        }
                      }}>View viewers</button>
                      <button className="btn btn-secondary" disabled={saving} onClick={() => perform(() => communityService.deleteStory(story.id), "Story deleted.")}>Delete story</button>
                  </div>
                )}
                {storyViewers[story.id]?.map((entry) => (
                  <small key={entry.id}>@{entry.viewer.username} · {new Date(entry.viewed_at).toLocaleString()}</small>
                ))}
              </article>
            ))}
          </div>
          {!loading && stories.length === 0 && <p className="card social-empty">No active stories. Share the first one.</p>}
        </section>
      )}

      {activeTab === "Groups & Pages" && (
        <section className="social-section">
          <form className="card social-form" onSubmit={createCommunity}>
            <h2>Create a group or page</h2>
            <input value={communityName} onChange={(e) => setCommunityName(e.target.value)} maxLength={100} placeholder="Name" required />
            <textarea value={communityDescription} onChange={(e) => setCommunityDescription(e.target.value)} maxLength={2000} placeholder="Description (optional)" />
            <select value={communityKind} onChange={(e) => setCommunityKind(e.target.value)} aria-label="Community type">
              <option value="group">Group</option><option value="page">Page</option>
            </select>
            <button className="btn btn-primary" disabled={saving}>Create</button>
          </form>
          <div className="social-grid">
            {communities.map((community) => (
              <article className="card social-card" key={community.id}>
                <span className="settings-badge">{community.kind}</span>
                <h2>{community.name}</h2><p>{community.description || "A RiceHub community."}</p>
                <small>{community.member_count} members · by @{community.owner.username}</small>
                {community.membership_role === "admin"
                  ? <button className="btn btn-secondary" onClick={() => loadCommunityPosts(community.id)}>Manage posts</button>
                  : community.membership_role
                    ? <><button className="btn btn-secondary" onClick={() => loadCommunityPosts(community.id)}>Posts</button><button className="btn btn-secondary" disabled={saving} onClick={() => perform(() => communityService.leaveCommunity(community.id), "Left community.")}>Leave</button></>
                  : <button className="btn btn-primary" disabled={saving} onClick={() => perform(() => communityService.joinCommunity(community.id), "Joined community.")}>Join</button>}
              </article>
            ))}
          </div>
          {expandedCommunityId && (
            <section className="card social-form">
              <h2>Community posts</h2>
              <form onSubmit={async (event) => {
                event.preventDefault();
                await perform(async () => {
                  await communityService.createCommunityPost(expandedCommunityId, communityPostText);
                  setCommunityPostText("");
                  await loadCommunityPosts(expandedCommunityId);
                }, "Community post published.");
              }}>
                <textarea value={communityPostText} onChange={(event) => setCommunityPostText(event.target.value)} placeholder="Write a post for members" required maxLength={5000} />
                <button className="btn btn-primary" disabled={saving}>Post to group</button>
              </form>
              {communityPosts.map((post) => (
                <article className="social-card" key={post.id}>
                  <strong>@{post.author.username}</strong><p>{post.content}</p>
                  {post.image && <img src={getMediaUrl(post.image)} alt="" />}
                  {(post.author.id === user?.id || communities.find((item) => item.id === expandedCommunityId)?.membership_role === "admin") && (
                    <button className="btn btn-secondary" disabled={saving} onClick={() => perform(() => communityService.removeCommunityPost(post.id), "Community post removed.")}>Remove post</button>
                  )}
                </article>
              ))}
            </section>
          )}
          {!loading && communities.length === 0 && <p className="card social-empty">No communities yet. Create one to get started.</p>}
        </section>
      )}

      {activeTab === "Events" && (
        <section className="social-section">
          <form className="card social-form" onSubmit={createEvent}>
            <h2>Create an event</h2>
            <input value={eventTitle} onChange={(e) => setEventTitle(e.target.value)} maxLength={160} placeholder="Event name" required />
            <textarea value={eventDescription} onChange={(e) => setEventDescription(e.target.value)} maxLength={4000} placeholder="Event details (optional)" />
            <input value={eventLocation} onChange={(e) => setEventLocation(e.target.value)} maxLength={255} placeholder="Location (optional)" />
            <label>Starts at<input type="datetime-local" value={eventDate} onChange={(e) => setEventDate(e.target.value)} required /></label>
            <button className="btn btn-primary" disabled={saving}>Create event</button>
          </form>
          <div className="social-grid">
            {events.map((item) => (
              <article className="card social-card" key={item.id}>
                <h2>{item.title}</h2><p>{item.location || "Location not specified"}</p>
                {item.description && <p>{item.description}</p>}
                <small>{new Date(item.starts_at).toLocaleString()} · hosted by @{item.host.username}</small>
                <small>{item.going_count} going · {item.interested_count} interested</small>
                <div className="social-actions">
                  <button className={`btn ${item.my_response === "going" ? "btn-secondary" : "btn-primary"}`} disabled={saving} onClick={() => perform(() => communityService.respondToEvent(item.id, "going"), "Marked as going.")}>Going</button>
                  <button className={`btn ${item.my_response === "interested" ? "btn-primary" : "btn-secondary"}`} disabled={saving} onClick={() => perform(() => communityService.respondToEvent(item.id, "interested"), "Marked as interested.")}>Interested</button>
                  {item.my_response && <button className="btn btn-secondary" disabled={saving} onClick={() => perform(() => communityService.cancelEventResponse(item.id), "Event response removed.")}>Not going</button>}
                </div>
                {item.host.id === user?.id && (
                  <>
                    <button className="btn btn-secondary" onClick={() => setEditingEventId((current) => current === item.id ? null : item.id)}>
                      {editingEventId === item.id ? "Close editor" : "Edit event"}
                    </button>
                    {editingEventId === item.id && (
                      <form className="social-form" onSubmit={(event) => {
                        event.preventDefault();
                        const form = new FormData(event.currentTarget);
                        return perform(() => communityService.updateEvent(item.id, {
                          title: form.get("title"),
                          description: form.get("description"),
                          location: form.get("location"),
                          starts_at: new Date(form.get("starts_at")).toISOString(),
                        }), "Event updated.");
                      }}>
                        <input name="title" defaultValue={item.title} maxLength={160} required aria-label="Edit event title" />
                        <textarea name="description" defaultValue={item.description} maxLength={4000} aria-label="Edit event description" />
                        <input name="location" defaultValue={item.location} maxLength={255} aria-label="Edit event location" />
                        <input name="starts_at" type="datetime-local" defaultValue={localDateTime(item.starts_at)} required aria-label="Edit event start time" />
                        <button className="btn btn-secondary" disabled={saving} type="submit">Save event</button>
                      </form>
                    )}
                    <div className="social-actions">
                      <select value={inviteSelection[item.id] || ""} onChange={(event) => setInviteSelection((current) => ({ ...current, [item.id]: event.target.value }))} aria-label="Choose a friend to invite">
                        <option value="">Choose a friend</option>
                        {friends.map((friend) => <option key={friend.id} value={friend.id}>@{friend.username}</option>)}
                      </select>
                      <button className="btn btn-secondary" disabled={saving || !inviteSelection[item.id]} onClick={() => perform(() => communityService.inviteFriendToEvent(item.id, inviteSelection[item.id]), "Event invitation sent.")}>Send invite</button>
                      <button className="btn btn-danger" disabled={saving} onClick={() => perform(() => communityService.deleteEvent(item.id), "Event deleted.")}>Delete event</button>
                    </div>
                  </>
                )}
              </article>
            ))}
          </div>
          {invitations.map((invitation) => (
            <article className="card social-card" key={invitation.id}>
              <p>@{invitation.inviter.username} invited you to <strong>{invitation.event_title}</strong>.</p>
              <div className="social-actions">
                <button className="btn btn-primary" disabled={saving} onClick={() => perform(() => communityService.respondToInvitation(invitation.id, "accepted"), "Invitation accepted.")}>Accept</button>
                <button className="btn btn-secondary" disabled={saving} onClick={() => perform(() => communityService.respondToInvitation(invitation.id, "declined"), "Invitation declined.")}>Decline</button>
              </div>
            </article>
          ))}
          {!loading && events.length === 0 && <p className="card social-empty">No upcoming events.</p>}
        </section>
      )}

      {activeTab === "Marketplace" && (
        <section className="social-section">
          <form className="social-search" onSubmit={(e) => { e.preventDefault(); load(); }}>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search listings" aria-label="Search listings" />
            <button className="btn btn-secondary" type="submit">Search</button>
          </form>
          <form className="card social-form" onSubmit={createListing}>
            <h2>List an item</h2>
            <p>RiceHub does not process online payments. Contact the seller to agree on payment and collection or delivery.</p>
            <input value={listingTitle} onChange={(e) => setListingTitle(e.target.value)} maxLength={160} placeholder="Item name" required />
            <textarea value={listingDescription} onChange={(e) => setListingDescription(e.target.value)} maxLength={3000} placeholder="Description" />
            <input type="number" min="0" step="0.01" value={listingPrice} onChange={(e) => setListingPrice(e.target.value)} placeholder="Price" required />
            <input value={listingLocation} onChange={(e) => setListingLocation(e.target.value)} maxLength={255} placeholder="Location" />
            <label>Photo (optional)<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setListingImage(e.target.files?.[0] || null)} /></label>
            <button className="btn btn-primary" disabled={saving}>Publish listing</button>
          </form>
          <div className="social-grid">
            {listings.map((listing) => (
              <article className="card social-card" key={listing.id}>
                {listing.image && <img src={getMediaUrl(listing.image)} alt={listing.title} />}
                <h2>{listing.title}</h2><p>{listing.description}</p>
                <strong>{Number(listing.price).toLocaleString()} PKR</strong>
                <small>{listing.location || "Location not specified"} · @{listing.seller.username}</small>
                {listing.seller.id === user?.id
                  ? <button className="btn btn-secondary" disabled={saving || listing.status === "sold"} onClick={() => perform(() => communityService.updateListing(listing.id, { status: "sold" }), "Listing marked as sold.")}>{listing.status === "sold" ? "Sold" : "Mark as sold"}</button>
                  : <a className="btn btn-secondary" href={`/messages?username=${encodeURIComponent(listing.seller.username)}`}>Contact seller</a>}
                {listing.seller.id !== user?.id && (
                  <button className="btn btn-primary" disabled={saving} onClick={() => perform(() => communityService.createOrder(listing.id), "Purchase request sent to seller.")}>Request to buy</button>
                )}
              </article>
            ))}
          </div>
          {!loading && listings.length === 0 && <p className="card social-empty">No listings match your search.</p>}
          {orders.map((order) => (
            <article className="card social-card" key={order.id}>
              <strong>{order.listing_title}</strong>
              <small>Buyer: @{order.buyer.username} · {order.status}</small>
              {order.status === "requested" && order.seller.id === user?.id && (
                <div className="social-actions">
                  <button className="btn btn-primary" disabled={saving} onClick={() => perform(() => communityService.updateOrder(order.id, "accepted"), "Request accepted; listing marked sold.")}>Accept request</button>
                  <button className="btn btn-secondary" disabled={saving} onClick={() => perform(() => communityService.updateOrder(order.id, "declined"), "Request declined.")}>Decline</button>
                </div>
              )}
              {order.status === "requested" && order.buyer.id === user?.id && <button className="btn btn-secondary" disabled={saving} onClick={() => perform(() => communityService.updateOrder(order.id, "cancelled"), "Purchase request cancelled.")}>Cancel request</button>}
              {order.status === "accepted" && order.seller.id === user?.id && <button className="btn btn-secondary" disabled={saving} onClick={() => perform(() => communityService.updateOrder(order.id, "completed"), "Sale marked complete.")}>Mark complete</button>}
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
