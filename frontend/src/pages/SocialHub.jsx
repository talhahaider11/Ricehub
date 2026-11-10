import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import communityService from "../services/communityService";
import useAuth from "../hooks/useAuth";
import friendService from "../services/friendService";
import StoryUploader from "../components/stories/StoryUploader";
import { getMediaUrl } from "../utils/constants";
import { getArrayResults } from "../utils/arrayResults";
import { useLanguage } from "../context/LanguageContext";

const tabs = ["Stories", "Groups & Pages", "Events", "Marketplace"];
const socialHubCache = new Map();
const orderStatusKeys = {
  requested: "orderRequested",
  accepted: "orderAccepted",
  declined: "orderDeclined",
  cancelled: "orderCancelled",
  completed: "orderCompleted",
};

function localDateTime(value) {
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function formatDateTime(value, language) {
  return new Intl.DateTimeFormat(language === "ur" ? "ur-PK" : undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function SocialHub() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(
    tabs.includes(searchParams.get("tab")) ? searchParams.get("tab") : tabs[0]
  );
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
    const cacheKey = activeTab === "Marketplace"
      ? `${activeTab}:${search.trim()}`
      : activeTab;
    const cachedData = socialHubCache.get(cacheKey);
    if (cachedData) {
      if (activeTab === "Stories") setStories(cachedData);
      if (activeTab === "Groups & Pages") setCommunities(cachedData);
      if (activeTab === "Events") {
        setEvents(cachedData.events);
        setFriends(cachedData.friends);
        setInvitations(cachedData.invitations);
      }
      if (activeTab === "Marketplace") {
        setListings(cachedData.listings);
        setOrders(cachedData.orders);
      }
    }
    setLoading(!cachedData);
    setError("");
    try {
      if (activeTab === "Stories") {
        const data = getArrayResults(await communityService.stories(), "Stories");
        socialHubCache.set(cacheKey, data);
        setStories(data);
      } else if (activeTab === "Groups & Pages") {
        const data = getArrayResults(await communityService.communities(), "Communities");
        socialHubCache.set(cacheKey, data);
        setCommunities(data);
      } else if (activeTab === "Events") {
        const [eventData, friendData, invitationData] = await Promise.all([
          communityService.events(),
          friendService.list(),
          communityService.invitations(),
        ]);
        const data = {
          events: getArrayResults(eventData, "Events"),
          friends: getArrayResults(friendData, "Friends"),
          invitations: getArrayResults(invitationData, "Event invitations"),
        };
        socialHubCache.set(cacheKey, data);
        setEvents(data.events);
        setFriends(data.friends);
        setInvitations(data.invitations);
      } else {
        const [listingResult, orderResult] = await Promise.allSettled([
          communityService.listings(search),
          communityService.orders(),
        ]);
        if (listingResult.status === "rejected") throw listingResult.reason;
        const orderData = orderResult.status === "fulfilled" ? orderResult.value : [];
        if (orderResult.status === "rejected") {
          console.error("Marketplace orders could not be loaded:", orderResult.reason);
          setError(t("marketplaceOrdersLoadFailed"));
        }
        const data = {
          listings: getArrayResults(listingResult.value, "Marketplace listings"),
          orders: getArrayResults(orderData, "Marketplace orders"),
        };
        socialHubCache.set(cacheKey, data);
        setListings(data.listings);
        setOrders(data.orders);
      }
    } catch (loadError) {
      console.error("Community features could not be loaded:", loadError);
      setError(loadError.response?.data?.detail || t("socialLoadFailed"));
    } finally {
      setLoading(false);
    }
  }, [activeTab, search, t]);

  const loadCommunityPosts = async (communityId) => {
    setError("");
    try {
      const data = await communityService.communityPosts(communityId);
      setCommunityPosts(getArrayResults(data, "Community posts"));
      setExpandedCommunityId(communityId);
    } catch (loadError) {
      console.error("Community posts could not be loaded:", loadError);
      setError(loadError.response?.data?.detail || t("socialLoadFailed"));
    }
  };

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const communityId = searchParams.get("community");
    const requestedTab = searchParams.get("tab");
    if (communityId && /^\d+$/.test(communityId)) {
      setActiveTab("Groups & Pages");
      loadCommunityPosts(communityId);
    } else {
      setActiveTab(tabs.includes(requestedTab) ? requestedTab : tabs[0]);
    }
  }, [searchParams]);

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
          : t("socialActionFailed")
      );
    } finally {
      setSaving(false);
    }
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
    }, t("groupPageCreated", {
      kind: t(communityKind === "group" ? "group" : "page"),
    }));
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
    }, t("eventCreated"));
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
    }, t("listingPublished"));
  };

  return (
    <div className="page-container social-hub">
      <header className="page-heading">
        <div>
          <h1>{t("discoverRiceHub")}</h1>
          <p>{t("discoverDescription")}</p>
        </div>
      </header>
      {error && <p className="settings-error" role="alert">{error}</p>}
      {notice && <p className="settings-status" role="status">{notice}</p>}
      <div className="social-tabs" role="tablist" aria-label={t("discoverSections")}>
        {tabs.map((tab) => (
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            className={activeTab === tab ? "active" : ""}
            key={tab}
            onClick={() => {
              setActiveTab(tab);
              setSearchParams({ tab }, { replace: true });
            }}
          >
            {t({
              Stories: "stories",
              "Groups & Pages": "groupsAndPages",
              Events: "events",
              Marketplace: "marketplace",
            }[tab])}
          </button>
        ))}
      </div>

      {activeTab === "Stories" && (
        <section className="social-section">
          <StoryUploader onCreated={() => {
            setNotice(t("storyLive"));
            void load();
          }} />
          <div className="social-grid">
            {stories.map((story) => (
              <article className="card social-card" key={story.id}>
                <strong>@{story.author.username}</strong>
                {(story.author.id === user?.id || viewedStories[story.id]) && (story.caption || story.text) && <p>{story.caption || story.text}</p>}
                {(story.author.id === user?.id || viewedStories[story.id]) && (story.media_url || story.image || story.video || story.media) && (story.media_type === "video" || /\.(mp4|webm|mov)(?:$|\?)/i.test(story.media_url || story.media || "")
                  ? <video src={getMediaUrl(story.media_url || story.video || story.media)} controls playsInline />
                  : <img src={getMediaUrl(story.media_url || story.image || story.media)} alt={t("stories")} />)}
                <small>{t("storyExpires")} {formatDateTime(story.expires_at, language)} · {new Intl.NumberFormat(language).format(story.view_count)} {t("views")}</small>
                {story.author.id !== user?.id && (
                  <button className="btn btn-secondary" disabled={saving || viewedStories[story.id]} onClick={() => perform(async () => {
                    await communityService.viewStory(story.id);
                    setViewedStories((current) => ({ ...current, [story.id]: true }));
                  }, t("storyOpened"))}>{viewedStories[story.id] ? t("viewed") : t("viewStory")}</button>
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
                          setError(viewerError.response?.data?.detail || t("storyViewersLoadFailed"));
                        }
                      }}>{t("viewViewers")}</button>
                      <button className="btn btn-secondary" disabled={saving} onClick={() => perform(() => communityService.deleteStory(story.id), t("storyDeleted"))}>{t("deleteStory")}</button>
                  </div>
                )}
                {storyViewers[story.id]?.map((entry) => (
                  <small key={entry.id}>@{entry.username} · {formatDateTime(entry.viewed_at, language)}</small>
                ))}
              </article>
            ))}
          </div>
          {!loading && stories.length === 0 && <p className="card social-empty">{t("noStories")}</p>}
        </section>
      )}

      {activeTab === "Groups & Pages" && (
        <section className="social-section">
          <form className="card social-form" onSubmit={createCommunity}>
            <h2>{t("createGroupOrPage")}</h2>
            <input value={communityName} onChange={(e) => setCommunityName(e.target.value)} maxLength={100} placeholder={t("name")} required />
            <textarea value={communityDescription} onChange={(e) => setCommunityDescription(e.target.value)} maxLength={2000} placeholder={t("optionalDescription")} />
            <select value={communityKind} onChange={(e) => setCommunityKind(e.target.value)} aria-label={t("communityType")}>
              <option value="group">{t("group")}</option><option value="page">{t("page")}</option>
            </select>
            <button className="btn btn-primary" disabled={saving}>{t("create")}</button>
          </form>
          <div className="social-grid">
            {communities.map((community) => (
              <article className="card social-card" key={community.id}>
                <span className="settings-badge">{t(community.kind)}</span>
                <h2>{community.name}</h2><p>{community.description || t("aCommunity")}</p>
                <small>{new Intl.NumberFormat(language).format(community.member_count)} {t("members")} · {t("by")} @{community.owner.username}</small>
                {community.membership_role === "admin"
                  ? <button className="btn btn-secondary" onClick={() => loadCommunityPosts(community.id)}>{t("managePosts")}</button>
                  : community.membership_role
                    ? <><button className="btn btn-secondary" onClick={() => loadCommunityPosts(community.id)}>{t("posts")}</button><button className="btn btn-secondary" disabled={saving} onClick={() => perform(() => communityService.leaveCommunity(community.id), t("leftCommunity"))}>{t("leave")}</button></>
                  : <button className="btn btn-primary" disabled={saving} onClick={() => perform(() => communityService.joinCommunity(community.id), t("joinedCommunity"))}>{t("join")}</button>}
              </article>
            ))}
          </div>
          {expandedCommunityId && (
            <section className="card social-form">
              <h2>{t("communityPosts")}</h2>
              <form onSubmit={async (event) => {
                event.preventDefault();
                await perform(async () => {
                  await communityService.createCommunityPost(expandedCommunityId, communityPostText);
                  setCommunityPostText("");
                  await loadCommunityPosts(expandedCommunityId);
                }, t("communityPostPublished"));
              }}>
                <textarea value={communityPostText} onChange={(event) => setCommunityPostText(event.target.value)} placeholder={t("writePostForMembers")} required maxLength={5000} />
                <button className="btn btn-primary" disabled={saving}>{t("postToGroup")}</button>
              </form>
              {communityPosts.map((post) => (
                <article className="social-card" key={post.id}>
                  <strong>@{post.author.username}</strong><p>{post.content}</p>
                  {post.image && <img src={getMediaUrl(post.image)} alt="" />}
                  {(post.author.id === user?.id || communities.find((item) => item.id === expandedCommunityId)?.membership_role === "admin") && (
                    <button className="btn btn-secondary" disabled={saving} onClick={() => perform(() => communityService.removeCommunityPost(post.id), t("communityPostRemoved"))}>{t("removePost")}</button>
                  )}
                </article>
              ))}
            </section>
          )}
          {!loading && communities.length === 0 && <p className="card social-empty">{t("noCommunities")}</p>}
        </section>
      )}

      {activeTab === "Events" && (
        <section className="social-section">
          <form className="card social-form" onSubmit={createEvent}>
            <h2>{t("createEvent")}</h2>
            <input value={eventTitle} onChange={(e) => setEventTitle(e.target.value)} maxLength={160} placeholder={t("eventName")} required />
            <textarea value={eventDescription} onChange={(e) => setEventDescription(e.target.value)} maxLength={4000} placeholder={t("optionalEventDetails")} />
            <input value={eventLocation} onChange={(e) => setEventLocation(e.target.value)} maxLength={255} placeholder={t("locationOptional")} />
            <label>{t("startsAt")}<input type="datetime-local" value={eventDate} onChange={(e) => setEventDate(e.target.value)} required /></label>
            <button className="btn btn-primary" disabled={saving}>{t("createEventButton")}</button>
          </form>
          <div className="social-grid">
            {events.map((item) => (
              <article className="card social-card" key={item.id}>
                <h2>{item.title}</h2><p>{item.location || t("eventLocationMissing")}</p>
                {item.description && <p>{item.description}</p>}
                <small>{formatDateTime(item.starts_at, language)} · {t("hostedBy")} @{item.host.username}</small>
                <small>{new Intl.NumberFormat(language).format(item.going_count)} {t("goingCount")} · {new Intl.NumberFormat(language).format(item.interested_count)} {t("interestedCount")}</small>
                <div className="social-actions">
                  <button className={`btn ${item.my_response === "going" ? "btn-secondary" : "btn-primary"}`} disabled={saving} onClick={() => perform(() => communityService.respondToEvent(item.id, "going"), t("markedGoing"))}>{t("going")}</button>
                  <button className={`btn ${item.my_response === "interested" ? "btn-primary" : "btn-secondary"}`} disabled={saving} onClick={() => perform(() => communityService.respondToEvent(item.id, "interested"), t("markedInterested"))}>{t("interested")}</button>
                  {item.my_response && <button className="btn btn-secondary" disabled={saving} onClick={() => perform(() => communityService.cancelEventResponse(item.id), t("responseRemoved"))}>{t("notGoing")}</button>}
                </div>
                {item.host.id === user?.id && (
                  <>
                    <button className="btn btn-secondary" onClick={() => setEditingEventId((current) => current === item.id ? null : item.id)}>
                      {editingEventId === item.id ? t("closeEditor") : t("editEvent")}
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
                        }), t("eventUpdated"));
                      }}>
                        <input name="title" defaultValue={item.title} maxLength={160} required aria-label={t("editEventTitle")} />
                        <textarea name="description" defaultValue={item.description} maxLength={4000} aria-label={t("editEventDescription")} />
                        <input name="location" defaultValue={item.location} maxLength={255} aria-label={t("editEventLocation")} />
                        <input name="starts_at" type="datetime-local" defaultValue={localDateTime(item.starts_at)} required aria-label={t("editEventTime")} />
                        <button className="btn btn-secondary" disabled={saving} type="submit">{t("saveEvent")}</button>
                      </form>
                    )}
                    <div className="social-actions">
                      <select value={inviteSelection[item.id] || ""} onChange={(event) => setInviteSelection((current) => ({ ...current, [item.id]: event.target.value }))} aria-label={t("chooseFriendToInvite")}>
                        <option value="">{t("chooseFriend")}</option>
                        {friends.map((friend) => <option key={friend.id} value={friend.id}>@{friend.username}</option>)}
                      </select>
                      <button className="btn btn-secondary" disabled={saving || !inviteSelection[item.id]} onClick={() => perform(() => communityService.inviteFriendToEvent(item.id, inviteSelection[item.id]), t("eventInviteSent"))}>{t("sendInvite")}</button>
                      <button className="btn btn-danger" disabled={saving} onClick={() => perform(() => communityService.deleteEvent(item.id), t("eventDeleted"))}>{t("deleteEvent")}</button>
                    </div>
                  </>
                )}
              </article>
            ))}
          </div>
          {invitations.map((invitation) => (
            <article className="card social-card" key={invitation.id}>
              <p>@{invitation.inviter.username} {t("invitedYouTo")} <strong>{invitation.event_title}</strong>.</p>
              <div className="social-actions">
                <button className="btn btn-primary" disabled={saving} onClick={() => perform(() => communityService.respondToInvitation(invitation.id, "accepted"), t("invitationAccepted"))}>{t("accept")}</button>
                <button className="btn btn-secondary" disabled={saving} onClick={() => perform(() => communityService.respondToInvitation(invitation.id, "declined"), t("invitationDeclined"))}>{t("decline")}</button>
              </div>
            </article>
          ))}
          {!loading && events.length === 0 && <p className="card social-empty">{t("noEvents")}</p>}
        </section>
      )}

      {activeTab === "Marketplace" && (
        <section className="social-section">
          <form className="social-search" onSubmit={(e) => { e.preventDefault(); load(); }}>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("searchListings")} aria-label={t("searchListings")} />
            <button className="btn btn-secondary" type="submit">{t("search")}</button>
          </form>
          <form className="card social-form" onSubmit={createListing}>
            <h2>{t("listAnItem")}</h2>
            <p>{t("marketplacePaymentNotice")}</p>
            <input value={listingTitle} onChange={(e) => setListingTitle(e.target.value)} maxLength={160} placeholder={t("itemName")} required />
            <textarea value={listingDescription} onChange={(e) => setListingDescription(e.target.value)} maxLength={3000} placeholder={t("description")} />
            <input type="number" min="0" step="0.01" value={listingPrice} onChange={(e) => setListingPrice(e.target.value)} placeholder={t("price")} required />
            <input value={listingLocation} onChange={(e) => setListingLocation(e.target.value)} maxLength={255} placeholder={t("location")} />
            <label>{t("optionalPhoto")}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setListingImage(e.target.files?.[0] || null)} /></label>
            <button className="btn btn-primary" disabled={saving}>{t("publishListing")}</button>
          </form>
          <div className="social-grid">
            {listings.map((listing) => (
              <article className="card social-card" key={listing.id}>
                {listing.image && <img src={getMediaUrl(listing.image)} alt={listing.title} />}
                <h2>{listing.title}</h2><p>{listing.description}</p>
                <strong>{new Intl.NumberFormat(language === "ur" ? "ur-PK" : "en-PK").format(Number(listing.price))} PKR</strong>
                <small>{listing.location || t("locationNotSpecified")} · @{listing.seller.username}</small>
                {listing.seller.id === user?.id
                  ? <button className="btn btn-secondary" disabled={saving || listing.status === "sold"} onClick={() => perform(() => communityService.updateListing(listing.id, { status: "sold" }), t("listingMarkedSold"))}>{listing.status === "sold" ? t("listingSold") : t("markAsSold")}</button>
                  : <a className="btn btn-secondary" href={`/messages?username=${encodeURIComponent(listing.seller.username)}`}>{t("contactSeller")}</a>}
                {listing.seller.id !== user?.id && (
                  <button className="btn btn-primary" disabled={saving} onClick={() => perform(() => communityService.createOrder(listing.id), t("purchaseRequestSent"))}>{t("requestToBuy")}</button>
                )}
              </article>
            ))}
          </div>
          {!loading && listings.length === 0 && <p className="card social-empty">{t("noListings")}</p>}
          {orders.map((order) => (
            <article className="card social-card" key={order.id}>
              <strong>{order.listing_title}</strong>
              <small>
                {t("buyer")}: @{order.buyer.username} ·
                {" "}
                {orderStatusKeys[order.status]
                  ? t(orderStatusKeys[order.status])
                  : order.status}
              </small>
              {order.status === "requested" && order.seller.id === user?.id && (
                <div className="social-actions">
                  <button className="btn btn-primary" disabled={saving} onClick={() => perform(() => communityService.updateOrder(order.id, "accepted"), t("purchaseRequestAccepted"))}>{t("accept")}</button>
                  <button className="btn btn-secondary" disabled={saving} onClick={() => perform(() => communityService.updateOrder(order.id, "declined"), t("requestDeclined"))}>{t("decline")}</button>
                </div>
              )}
              {order.status === "requested" && order.buyer.id === user?.id && <button className="btn btn-secondary" disabled={saving} onClick={() => perform(() => communityService.updateOrder(order.id, "cancelled"), t("purchaseRequestCancelled"))}>{t("cancelRequest")}</button>}
              {order.status === "accepted" && order.seller.id === user?.id && <button className="btn btn-secondary" disabled={saving} onClick={() => perform(() => communityService.updateOrder(order.id, "completed"), t("saleCompleted"))}>{t("markComplete")}</button>}
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
