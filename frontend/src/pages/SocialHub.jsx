import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import communityService from "../services/communityService";
import useAuth from "../hooks/useAuth";
import friendService from "../services/friendService";
import StoryUploader from "../components/stories/StoryUploader";
import Avatar from "../components/common/Avatar";
import Modal from "../components/common/Modal";
import VerifiedBadge from "../components/common/VerifiedBadge";
import { getMediaUrl } from "../utils/constants";
import { getArrayResults } from "../utils/arrayResults";
import { useLanguage } from "../context/LanguageContext";
import CommunityPostCard from "../components/posts/CommunityPostCard";

const tabs = ["Stories", "Groups & Pages", "Events", "Marketplace"];
const socialHubCache = new Map();
const MARKETPLACE_VERIFICATION_GRACE_MS = 5 * 24 * 60 * 60 * 1000;
const MARKETPLACE_VERIFICATION_REQUIRED_DETAIL =
  "First verify your account to create events or list items on the Marketplace.";
const orderStatusKeys = {
  requested: "orderRequested",
  accepted: "orderAccepted",
  declined: "orderDeclined",
  cancelled: "orderCancelled",
  completed: "orderCompleted",
};

function hasActiveMarketplaceVerification(user, now) {
  if (user?.is_verified !== true || user?.is_subscription_verified === false) {
    return false;
  }
  if (!user?.subscription_expires_at) return true;

  const expiryTime = new Date(user.subscription_expires_at).getTime();
  return Number.isFinite(expiryTime)
    && now < expiryTime + MARKETPLACE_VERIFICATION_GRACE_MS;
}

function MarketplaceVerificationRequiredCard({ t }) {
  return (
    <section className="card marketplace-verification-required">
      <h2>{t("marketplaceVerificationRequiredTitle")}</h2>
      <p>{t("marketplaceVerificationRequiredMessage")}</p>
      <Link className="btn btn-primary" to="/billing">
        {t("marketplaceGetVerified")}
      </Link>
    </section>
  );
}

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
  const [verificationNow, setVerificationNow] = useState(() => Date.now());
  const [marketplaceVerificationDenied, setMarketplaceVerificationDenied] = useState(false);
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
  const [managedCommunityId, setManagedCommunityId] = useState(null);
  const [communityMembers, setCommunityMembers] = useState([]);
  const [communityMembersLoading, setCommunityMembersLoading] = useState(false);
  const [communityMembersError, setCommunityMembersError] = useState("");
  const communityPostsRef = useRef(null);
  const eventInterestVersionRef = useRef(0);
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
  const [editingCommunity, setEditingCommunity] = useState(null);
  const [eventTitle, setEventTitle] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventEndDate, setEventEndDate] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [eventBanner, setEventBanner] = useState(null);
  const eventBannerInputRef = useRef(null);
  const [editingEventId, setEditingEventId] = useState(null);
  const [interestedUsersEvent, setInterestedUsersEvent] = useState(null);
  const [interestedUsers, setInterestedUsers] = useState([]);
  const [interestedUsersLoading, setInterestedUsersLoading] = useState(false);
  const [interestedUsersError, setInterestedUsersError] = useState("");
  const [listingTitle, setListingTitle] = useState("");
  const [listingDescription, setListingDescription] = useState("");
  const [listingPrice, setListingPrice] = useState("");
  const [listingLocation, setListingLocation] = useState("");
  const [listingImage, setListingImage] = useState(null);
  const marketplaceVerificationActive = !marketplaceVerificationDenied
    && hasActiveMarketplaceVerification(user, verificationNow);

  useEffect(() => {
    const timer = window.setInterval(() => setVerificationNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setMarketplaceVerificationDenied(false);
  }, [
    user?.id,
    user?.is_verified,
    user?.is_subscription_verified,
    user?.subscription_expires_at,
  ]);

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
        const eventInterestVersion = eventInterestVersionRef.current;
        const [eventData, friendData, invitationData] = await Promise.all([
          communityService.events(),
          friendService.list(),
          communityService.invitations(),
        ]);
        const fetchedEvents = getArrayResults(eventData, "Events");
        const hasNewerInterestState =
          eventInterestVersion !== eventInterestVersionRef.current;
        const latestCachedEvents = socialHubCache.get(cacheKey)?.events;
        const data = {
          events: hasNewerInterestState && latestCachedEvents
            ? latestCachedEvents
            : fetchedEvents,
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
    setManagedCommunityId(null);
    setCommunityMembers([]);
    setExpandedCommunityId(communityId);
    setCommunityPosts([]);
    setError("");
    try {
      const data = await communityService.communityPosts(communityId);
      setCommunityPosts(getArrayResults(data, "Community posts"));
    } catch (loadError) {
      console.error("Community posts could not be loaded:", loadError);
      setError(loadError.response?.data?.detail || t("socialLoadFailed"));
    }
  };

  const openCommunityPosts = (communityId) => {
    const params = new URLSearchParams(searchParams);
    params.set("tab", "Groups & Pages");
    params.set("community", String(communityId));
    setSearchParams(params);
    loadCommunityPosts(communityId);
  };

  const loadCommunityMembers = async (communityId) => {
    const params = new URLSearchParams(searchParams);
    params.set("tab", "Groups & Pages");
    params.delete("community");
    setSearchParams(params);
    setExpandedCommunityId(null);
    setCommunityPosts([]);
    setManagedCommunityId(communityId);
    setCommunityMembers([]);
    setCommunityMembersError("");
    setCommunityMembersLoading(true);
    setError("");
    try {
      const data = await communityService.communityMembers(communityId);
      setCommunityMembers(getArrayResults(data, "Community members"));
    } catch (loadError) {
      console.error("Community members could not be loaded:", loadError);
      setCommunityMembersError(
        loadError.response?.data?.detail || t("communityMembersLoadFailed")
      );
    } finally {
      setCommunityMembersLoading(false);
    }
  };

  const closeCommunityMembers = () => {
    setManagedCommunityId(null);
    setCommunityMembers([]);
    setCommunityMembersError("");
  };

  const closeCommunityPosts = () => {
    setExpandedCommunityId(null);
    setCommunityPosts([]);
    const params = new URLSearchParams(searchParams);
    params.delete("community");
    params.set("tab", "Groups & Pages");
    setSearchParams(params);
  };

  useEffect(() => {
    if (expandedCommunityId) {
      communityPostsRef.current?.scrollIntoView?.({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [expandedCommunityId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const communityId = searchParams.get("community");
    const requestedTab = searchParams.get("tab");
    if (communityId && /^\d+$/.test(communityId)) {
      setActiveTab("Groups & Pages");
      if (String(expandedCommunityId) !== communityId) {
        loadCommunityPosts(communityId);
      }
    } else {
      setActiveTab(tabs.includes(requestedTab) ? requestedTab : tabs[0]);
    }
  }, [searchParams, expandedCommunityId]);

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
      if (
        actionError.response?.status === 403
        && detail === MARKETPLACE_VERIFICATION_REQUIRED_DETAIL
      ) {
        setMarketplaceVerificationDenied(true);
      }
      setError(
        typeof detail === "string"
          ? detail
          : t("socialActionFailed")
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleEventInterest = async (item) => {
    const wasInterested = typeof item.is_interested === "boolean"
      ? item.is_interested
      : item.my_response === "interested";
    const isInterested = !wasInterested;
    const previousEvents = events;
    const cachedData = socialHubCache.get("Events");
    const previousCache = cachedData || {
      events: previousEvents,
      friends,
      invitations,
    };
    const updateEventList = (eventList) => eventList.map((event) => {
      if (event.id !== item.id) return event;
      const currentCount = Number(event.interested_count);
      return {
        ...event,
        is_interested: isInterested,
        my_response: isInterested ? "interested" : null,
        interested_count: Math.max(
          0,
          (Number.isFinite(currentCount) ? currentCount : 0)
            + (isInterested ? 1 : -1)
        ),
      };
    });

    const updatedEvents = updateEventList(events);
    eventInterestVersionRef.current += 1;
    setEvents(updatedEvents);
    socialHubCache.set("Events", {
      ...previousCache,
      events: updateEventList(previousCache.events || events),
    });

    setSaving(true);
    setError("");
    setNotice("");
    try {
      if (isInterested) {
        await communityService.respondToEvent(item.id, "interested");
      } else {
        await communityService.cancelEventResponse(item.id);
      }
      setNotice(t(isInterested ? "markedInterested" : "responseRemoved"));
      eventInterestVersionRef.current += 1;
      await load();
    } catch (actionError) {
      eventInterestVersionRef.current += 1;
      setEvents(previousEvents);
      if (cachedData) {
        socialHubCache.set("Events", previousCache);
      } else {
        socialHubCache.delete("Events");
      }
      setError(
        typeof actionError.response?.data?.detail === "string"
          ? actionError.response.data.detail
          : t("socialActionFailed")
      );
    } finally {
      setSaving(false);
    }
  };

  const removeCommunityMember = (member) => {
    if (managedCommunityId == null) return;
    const communityId = managedCommunityId;
    return perform(async () => {
      await communityService.removeCommunityMember(
        communityId,
        member.user_id
      );
      socialHubCache.delete("Groups & Pages");
      setCommunityMembers((current) => current.filter(
        (item) => String(item.user_id) !== String(member.user_id)
      ));
      setCommunities((current) => current.map((community) => (
        String(community.id) === String(communityId)
          ? {
            ...community,
            member_count: Number.isFinite(Number(community.member_count))
              ? Math.max(0, Number(community.member_count) - 1)
              : community.member_count,
          }
          : community
      )));
    }, t("communityMemberRemoved"));
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
      socialHubCache.delete("Groups & Pages");
      setCommunityName("");
      setCommunityDescription("");
    }, t("groupPageCreated", {
      kind: t(communityKind === "group" ? "group" : "page"),
    }));
  };

  const updateCommunity = (event) => {
    event.preventDefault();
    if (!editingCommunity) return;
    return perform(async () => {
      await communityService.updateCommunity(editingCommunity.id, {
        name: editingCommunity.name,
        description: editingCommunity.description,
        visibility: editingCommunity.visibility,
      });
      socialHubCache.delete("Groups & Pages");
      setEditingCommunity(null);
    }, t("communityUpdated"));
  };

  const createEvent = async (event) => {
    event.preventDefault();
    if (!marketplaceVerificationActive) return;
    const startsAt = new Date(eventDate);
    const endsAt = eventEndDate ? new Date(eventEndDate) : null;
    if (
      Number.isNaN(startsAt.getTime())
      || (endsAt && Number.isNaN(endsAt.getTime()))
      || (endsAt && endsAt <= startsAt)
    ) {
      setError(t("invalidEventTime"));
      setNotice("");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");
    try {
      const createdEvent = await communityService.createEvent({
        title: eventTitle,
        description: eventDescription,
        location: eventLocation,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt ? endsAt.toISOString() : null,
        ...(eventBanner ? { banner: eventBanner } : {}),
      });
      const cachedEvents = socialHubCache.get("Events");
      const currentEvents = cachedEvents?.events || events;
      const updatedEvents = [
        ...currentEvents.filter((item) => item.id !== createdEvent.id),
        createdEvent,
      ].sort((left, right) => (
        new Date(left.starts_at) - new Date(right.starts_at)
      ));
      setEvents(updatedEvents);
      if (cachedEvents) {
        socialHubCache.set("Events", {
          ...cachedEvents,
          events: updatedEvents,
        });
      }
      setEventTitle("");
      setEventDescription("");
      setEventLocation("");
      setEventDate("");
      setEventEndDate("");
      setEventBanner(null);
      if (eventBannerInputRef.current) eventBannerInputRef.current.value = "";
      setNotice(t("eventCreated"));
    } catch (createError) {
      console.error("Event could not be created:", createError);
      const responseData = createError.response?.data;
      if (
        createError.response?.status === 403
        && responseData?.detail === MARKETPLACE_VERIFICATION_REQUIRED_DETAIL
      ) {
        setMarketplaceVerificationDenied(true);
      }
      const validationMessages = responseData && typeof responseData === "object"
        ? Object.values(responseData)
          .flatMap((value) => Array.isArray(value) ? value : [value])
          .filter((value) => typeof value === "string" && value.trim())
        : [];
      setError(
        (typeof responseData?.detail === "string" && responseData.detail)
        || validationMessages.join(" ")
        || createError.message
        || t("socialActionFailed")
      );
    } finally {
      setSaving(false);
    }
  };

  const createListing = (event) => {
    event.preventDefault();
    if (!marketplaceVerificationActive) return;
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

  const showInterestedUsers = async (item) => {
    setInterestedUsersEvent(item);
    setInterestedUsers([]);
    setInterestedUsersError("");
    if (Array.isArray(item.interested_users)) {
      setInterestedUsers(item.interested_users);
      setInterestedUsersLoading(false);
      return;
    }
    setInterestedUsersLoading(true);
    try {
      const users = await communityService.eventInterestedUsers(item.id);
      setInterestedUsers(getArrayResults(users, "Interested users"));
    } catch (loadError) {
      console.error("Event interested users could not be loaded:", loadError);
      setInterestedUsersError(t("interestedUsersLoadFailed"));
    } finally {
      setInterestedUsersLoading(false);
    }
  };

  const closeInterestedUsers = () => {
    setInterestedUsersEvent(null);
    setInterestedUsersError("");
  };

  const managedCommunity = communities.find(
    (item) => String(item.id) === String(managedCommunityId)
  );

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
          {editingCommunity && (
            <form className="card social-form" onSubmit={updateCommunity}>
              <h2>{t("editPage")}</h2>
              <input
                value={editingCommunity.name}
                onChange={(event) => setEditingCommunity((current) => ({
                  ...current,
                  name: event.target.value,
                }))}
                maxLength={100}
                placeholder={t("name")}
                required
              />
              <textarea
                value={editingCommunity.description}
                onChange={(event) => setEditingCommunity((current) => ({
                  ...current,
                  description: event.target.value,
                }))}
                maxLength={2000}
                placeholder={t("optionalDescription")}
              />
              <select
                value={editingCommunity.visibility}
                onChange={(event) => setEditingCommunity((current) => ({
                  ...current,
                  visibility: event.target.value,
                }))}
                aria-label={t("communityVisibility")}
              >
                <option value="public">{t("public")}</option>
                <option value="private">{t("private")}</option>
              </select>
              <div className="social-actions">
                <button className="btn btn-primary" disabled={saving}>{t("save")}</button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={saving}
                  onClick={() => setEditingCommunity(null)}
                >
                  {t("cancel")}
                </button>
              </div>
            </form>
          )}
          <div className="social-grid">
            {communities.map((community) => (
              <article className="card social-card" key={community.id}>
                <span className="settings-badge">{t(community.kind)}</span>
                <h2>{community.name}</h2><p>{community.description || t("aCommunity")}</p>
                <small>{new Intl.NumberFormat(language).format(community.member_count)} {t("members")} · {t("by")} @{community.owner.username}</small>
                {community.kind === "page" && community.membership_role === "admin" && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setEditingCommunity({
                      id: community.id,
                      name: community.name,
                      description: community.description || "",
                      visibility: community.visibility,
                    })}
                  >
                    {t("editPage")}
                  </button>
                )}
                {community.membership_role === "admin"
                  ? <>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => loadCommunityMembers(community.id)}
                      disabled={communityMembersLoading}
                    >
                      {t("manageMembers")}
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={() => openCommunityPosts(community.id)}>{t("managePosts")}</button>
                  </>
                  : community.membership_role
                    ? <><button type="button" className="btn btn-secondary" onClick={() => openCommunityPosts(community.id)}>{t("communityViewPosts")}</button><button type="button" className="btn btn-secondary" disabled={saving} onClick={() => perform(async () => {
                      await communityService.leaveCommunity(community.id);
                      socialHubCache.delete("Groups & Pages");
                    }, t("leftCommunity"))}>{t("leave")}</button></>
                    : <>
                      {community.visibility === "public" && (
                        <button type="button" className="btn btn-secondary" onClick={() => openCommunityPosts(community.id)}>{t("communityViewPosts")}</button>
                      )}
                      <button type="button" className="btn btn-primary" disabled={saving} onClick={() => perform(async () => {
                        await communityService.joinCommunity(community.id);
                        socialHubCache.delete("Groups & Pages");
                      }, t("joinedCommunity"))}>{t("join")}</button>
                    </>}
              </article>
            ))}
          </div>
          {managedCommunityId && (
            <section className="card social-form community-members-panel">
              <div className="social-actions">
                <h2>
                  {t("communityMembers")}
                  {managedCommunity?.name
                    ? ` · ${managedCommunity.name}`
                    : ""}
                </h2>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={closeCommunityMembers}
                >
                  {t("close")}
                </button>
              </div>
              {communityMembersLoading && <p>{t("loadingCommunityMembers")}</p>}
              {communityMembersError && (
                <p className="settings-error" role="alert">
                  {communityMembersError}
                </p>
              )}
              {!communityMembersLoading && !communityMembersError
                && communityMembers.length === 0 && (
                  <p className="social-empty">{t("noCommunityMembers")}</p>
                )}
              {!communityMembersLoading && !communityMembersError
                && communityMembers.length > 0 && (
                  <ul className="community-member-list">
                    {communityMembers.map((member) => {
                      const isOwner = String(managedCommunity?.owner?.id)
                        === String(user?.id);
                      const isProtectedMember =
                        String(member.user_id) === String(user?.id)
                        || String(member.user_id) === String(managedCommunity?.owner?.id);
                      const canRemove = !isProtectedMember
                        && (member.role !== "admin" || isOwner);
                      const displayName = [
                        member.first_name,
                        member.last_name,
                      ].filter(Boolean).join(" ") || member.username;
                      return (
                        <li key={member.user_id} className="community-member-row">
                          <span>
                            <strong>{displayName}</strong>
                            <small>
                              @{member.username} · {t(
                                member.role === "admin"
                                  ? "communityAdmin"
                                  : "communityMember"
                              )}
                            </small>
                          </span>
                          {canRemove && (
                            <button
                              type="button"
                              className="btn btn-danger"
                              disabled={saving}
                              aria-label={`${t("removeMember")} @${member.username}`}
                              onClick={() => removeCommunityMember(member)}
                            >
                              {t("removeMember")}
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
            </section>
          )}
          {expandedCommunityId && (
            <section className="card social-form" ref={communityPostsRef} id="community-posts">
              <div className="social-actions">
                <h2>
                  {t("communityPosts")}
                  {communities.find((item) => String(item.id) === String(expandedCommunityId))?.name
                    ? ` · ${communities.find((item) => String(item.id) === String(expandedCommunityId)).name}`
                    : ""}
                </h2>
                <button type="button" className="btn btn-secondary" onClick={closeCommunityPosts}>
                  {t("backToPages")}
                </button>
              </div>
              {(() => {
                const activeCommunity = communities.find(
                  (item) => String(item.id) === String(expandedCommunityId)
                );
                const pageOwner = activeCommunity?.kind === "page"
                  && String(activeCommunity.owner?.id) === String(user?.id);
                const canCreatePagePost = pageOwner && user?.is_verified;
                const canCreateGroupPost = activeCommunity?.kind === "group"
                  && Boolean(activeCommunity.membership_role);
                const createPostForm = (buttonLabel) => (
                  <form onSubmit={async (event) => {
                    event.preventDefault();
                    await perform(async () => {
                      await communityService.createCommunityPost(
                        expandedCommunityId,
                        communityPostText
                      );
                      setCommunityPostText("");
                      await loadCommunityPosts(expandedCommunityId);
                    }, t("communityPostPublished"));
                  }}>
                    <textarea
                      value={communityPostText}
                      onChange={(event) => setCommunityPostText(event.target.value)}
                      placeholder={t("writePostForMembers")}
                      required
                      maxLength={5000}
                    />
                    <button className="btn btn-primary" disabled={saving}>
                      {t(buttonLabel)}
                    </button>
                  </form>
                );
                return (
                  <>
                    {canCreatePagePost && createPostForm("postToPage")}
                    {pageOwner && !user?.is_verified && (
                      <p className="settings-error" role="status">
                        {t("pagePostVerifiedRequired")}
                      </p>
                    )}
                    {canCreateGroupPost && createPostForm("postToGroup")}
                    {communityPosts.map((post) => (
                      <CommunityPostCard
                        key={post.id}
                        post={post}
                        canManage={
                          String(post.author?.id) === String(user?.id)
                          || activeCommunity?.membership_role === "admin"
                        }
                        onUpdated={(postId, updates) => setCommunityPosts((current) =>
                          current.map((item) => item.id === postId
                            ? { ...item, ...updates }
                            : item)
                        )}
                        onDeleted={(postId) => perform(async () => {
                          await communityService.removeCommunityPost(postId);
                          await loadCommunityPosts(expandedCommunityId);
                        }, t("communityPostRemoved"))}
                      />
                    ))}
                    {communityPosts.length === 0 && (
                      <p className="social-empty">{t("noCommunityPosts")}</p>
                    )}
                  </>
                );
              })()}
            </section>
          )}
          {!loading && communities.length === 0 && <p className="card social-empty">{t("noCommunities")}</p>}
        </section>
      )}

      {activeTab === "Events" && (
        <section className="social-section">
          {marketplaceVerificationActive ? (
            <form className="card social-form" onSubmit={createEvent}>
              <h2>{t("createEvent")}</h2>
              <input value={eventTitle} onChange={(e) => setEventTitle(e.target.value)} maxLength={160} placeholder={t("eventName")} required />
              <textarea value={eventDescription} onChange={(e) => setEventDescription(e.target.value)} maxLength={4000} placeholder={t("optionalEventDetails")} />
              <input value={eventLocation} onChange={(e) => setEventLocation(e.target.value)} maxLength={255} placeholder={t("locationOptional")} />
              <label>{t("startsAt")}<input type="datetime-local" value={eventDate} onChange={(e) => setEventDate(e.target.value)} required /></label>
              <label>{t("endsAtOptional")}<input type="datetime-local" value={eventEndDate} onChange={(e) => setEventEndDate(e.target.value)} /></label>
              <label>{t("eventBannerOptional")}<input ref={eventBannerInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setEventBanner(e.target.files?.[0] || null)} /></label>
              <button className="btn btn-primary" disabled={saving}>{t("createEventButton")}</button>
            </form>
          ) : (
            <MarketplaceVerificationRequiredCard t={t} />
          )}
          <div className="social-grid">
            {events.map((item) => (
              <article className="card social-card" key={item.id}>
                {item.banner && (
                  <img
                    className="event-banner-image"
                    src={getMediaUrl(item.banner)}
                    alt={item.title}
                    onError={(event) => {
                      event.currentTarget.hidden = true;
                    }}
                  />
                )}
                <h2>{item.title}</h2><p>{item.location || t("eventLocationMissing")}</p>
                {item.description && <p>{item.description}</p>}
                <small>{formatDateTime(item.starts_at, language)} · {t("hostedBy")} @{item.host.username}</small>
                {String(item.host.id) === String(user?.id) ? (
                  <button
                    className="event-interested-count"
                    type="button"
                    onClick={() => void showInterestedUsers(item)}
                  >
                    {new Intl.NumberFormat(language).format(item.interested_count)} {t("interestedCount")}
                  </button>
                ) : (
                  <small>
                    {new Intl.NumberFormat(language).format(item.interested_count)} {t("interestedCount")}
                  </small>
                )}
                <div className="social-actions">
                  <button
                    className={`btn ${(typeof item.is_interested === "boolean"
                      ? item.is_interested
                      : item.my_response === "interested") ? "btn-primary" : "btn-secondary"}`}
                    disabled={saving}
                    onClick={() => void toggleEventInterest(item)}
                  >
                    {t((typeof item.is_interested === "boolean"
                      ? item.is_interested
                      : item.my_response === "interested")
                      ? "uninterested"
                      : "interested")}
                  </button>
                </div>
                {String(item.host.id) !== String(user?.id) && (
                  <Link
                    className="btn btn-secondary"
                    to={`/messages?username=${encodeURIComponent(item.host.username)}`}
                  >
                    {t("contactHost")}
                  </Link>
                )}
                {item.host.id === user?.id && (
                  <>
                    {marketplaceVerificationActive && (
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
                              ends_at: form.get("ends_at")
                                ? new Date(form.get("ends_at")).toISOString()
                                : null,
                              ...(form.get("banner")?.size
                                ? { banner: form.get("banner") }
                                : {}),
                            }), t("eventUpdated"));
                          }}>
                            <input name="title" defaultValue={item.title} maxLength={160} required aria-label={t("editEventTitle")} />
                            <textarea name="description" defaultValue={item.description} maxLength={4000} aria-label={t("editEventDescription")} />
                            <input name="location" defaultValue={item.location} maxLength={255} aria-label={t("editEventLocation")} />
                            <input name="starts_at" type="datetime-local" defaultValue={localDateTime(item.starts_at)} required aria-label={t("editEventTime")} />
                            <input name="ends_at" type="datetime-local" defaultValue={item.ends_at ? localDateTime(item.ends_at) : ""} aria-label={t("editEventEndTime")} />
                            <label>{t("eventBannerOptional")}<input name="banner" type="file" accept="image/jpeg,image/png,image/webp" /></label>
                            <button className="btn btn-secondary" disabled={saving} type="submit">{t("saveEvent")}</button>
                          </form>
                        )}
                      </>
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
          {marketplaceVerificationActive ? (
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
          ) : (
            <MarketplaceVerificationRequiredCard t={t} />
          )}
          <div className="social-grid">
            {listings.map((listing) => (
              <article className="card social-card" key={listing.id}>
                {listing.image && (
                  <img
                    className="marketplace-listing-image"
                    src={getMediaUrl(listing.image)}
                    alt={listing.title}
                    onError={(event) => {
                      event.currentTarget.hidden = true;
                    }}
                  />
                )}
                <h2>{listing.title}</h2><p>{listing.description}</p>
                <strong>{new Intl.NumberFormat(language === "ur" ? "ur-PK" : "en-PK").format(Number(listing.price))} PKR</strong>
                <small>{listing.location || t("locationNotSpecified")} · @{listing.seller.username}</small>
                {listing.seller.id === user?.id
                  ? listing.status === "sold"
                    ? <button className="btn btn-secondary" disabled>{t("listingSold")}</button>
                    : marketplaceVerificationActive && <button className="btn btn-secondary" disabled={saving} onClick={() => perform(() => communityService.updateListing(listing.id, { status: "sold" }), t("listingMarkedSold"))}>{t("markAsSold")}</button>
                  : <Link className="btn btn-secondary" to={`/messages?username=${encodeURIComponent(listing.seller.username)}`}>{t("contactSeller")}</Link>}
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
                {orderStatusKeys[order.status]
                  ? t(orderStatusKeys[order.status])
                  : order.status}
              </small>
              {order.seller.id === user?.id && (
                <div className="marketplace-buyer-profile">
                  <Link
                    className="marketplace-buyer-profile__identity"
                    to={`/profile/${order.buyer.id}`}
                  >
                    <Avatar
                      user={order.buyer}
                      name={order.buyer.full_name}
                      size={36}
                    />
                    <span>{order.buyer.full_name || `@${order.buyer.username}`}</span>
                    <VerifiedBadge verified={order.buyer.is_verified} />
                  </Link>
                  <Link
                    className="btn btn-secondary marketplace-buyer-profile__action"
                    to={`/profile/${order.buyer.id}`}
                  >
                    {t("viewProfile")}
                  </Link>
                </div>
              )}
              {order.seller.id !== user?.id && (
                <small>{t("buyer")}: @{order.buyer.username}</small>
              )}
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
      <Modal
        open={Boolean(interestedUsersEvent)}
        onClose={closeInterestedUsers}
        title={t("interestedUsers")}
      >
        {interestedUsersEvent && (
          <div>
            <p>{interestedUsersEvent.title}</p>
            {interestedUsersLoading && <p className="muted">{t("loading")}</p>}
            {interestedUsersError && (
              <p className="settings-error" role="alert">{interestedUsersError}</p>
            )}
            {!interestedUsersLoading && !interestedUsersError && interestedUsers.length === 0 && (
              <p className="social-empty">{t("noInterestedUsers")}</p>
            )}
            {interestedUsers.length > 0 && (
              <ul className="community-member-list">
                {interestedUsers.map((interestedUser) => (
                  <li key={interestedUser.id}>
                    <Link
                      className="community-member-row event-interested-user"
                      to={`/profile/${interestedUser.id}`}
                      onClick={closeInterestedUsers}
                    >
                      <Avatar
                        src={interestedUser.avatar}
                        name={interestedUser.full_name}
                        size={40}
                      />
                      <span>
                        <strong>{interestedUser.full_name}</strong>
                        <small>
                          @{interestedUser.username}
                          <VerifiedBadge verified={interestedUser.is_verified} />
                        </small>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
