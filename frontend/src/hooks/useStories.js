import { useCallback, useEffect, useRef, useState } from "react";

import storyService from "../services/storyService";
import { getArrayResults } from "../utils/arrayResults";

const STORY_LIFETIME_MS = 24 * 60 * 60 * 1000;
const STORY_CACHE_TTL_MS = 2 * 60 * 1000;

function getStoryCacheKey(authorId, userId) {
  if (userId == null) return null;
  return `ricehub:stories:v1:${userId}:${authorId ?? "all"}`;
}

function writeStoryCache(key, value) {
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn("Story cache could not be saved:", error);
  }
}

function readStoryCache(key) {
  if (!key) return null;
  const cached = localStorage.getItem(key);
  if (!cached) return null;
  try {
    const parsed = JSON.parse(cached);
    if (!Array.isArray(parsed.stories) || !Number.isFinite(parsed.updatedAt)) {
      localStorage.removeItem(key);
      return null;
    }
    return parsed;
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    localStorage.removeItem(key);
    return null;
  }
}

function getInitialStories(initialStories, cache) {
  if (Array.isArray(initialStories)) {
    return initialStories;
  }
  return cache?.stories || [];
}

function getActiveStories(items, authorId) {
  const now = Date.now();
  return items.filter((story) => {
    if (
      authorId != null
      && String(story.author?.id) !== String(authorId)
    ) return false;

    const expiresAt = story.expires_at
      ? new Date(story.expires_at).getTime()
      : new Date(story.created_at).getTime() + STORY_LIFETIME_MS;
    return !Number.isFinite(expiresAt) || expiresAt >= now;
  });
}

export default function useStories(authorId, initialStories = null, userId) {
  const cacheKey = getStoryCacheKey(authorId, userId);
  const [cacheState, setCacheState] = useState(() => {
    const cached = readStoryCache(cacheKey);
    return cached ? { ...cached, key: cacheKey } : null;
  });
  const [storyState, setStoryState] = useState(() => ({
    key: cacheKey,
    stories: getActiveStories(
      getInitialStories(initialStories, readStoryCache(cacheKey)),
      authorId
    ),
  }));
  const stories = storyState.key === cacheKey ? storyState.stories : [];
  const storiesRef = useRef(stories);
  storiesRef.current = stories;
  const hasCachedStories = cacheState?.key === cacheKey
    || Array.isArray(initialStories);
  const [loading, setLoading] = useState(!hasCachedStories);
  const [error, setError] = useState("");

  const saveStories = useCallback((items, updatedAt = Date.now()) => {
    const activeStories = getActiveStories(items, authorId);
    setStoryState({ key: cacheKey, stories: activeStories });
    const nextCache = { key: cacheKey, updatedAt, stories: activeStories };
    setCacheState(nextCache);
    writeStoryCache(cacheKey, nextCache);
  }, [authorId, cacheKey]);

  const loadStories = useCallback(async ({ force = false } = {}) => {
    const matchingCache = cacheState?.key === cacheKey
      ? cacheState
      : readStoryCache(cacheKey);
    if (
      !force
      && matchingCache
      && Date.now() - matchingCache.updatedAt < STORY_CACHE_TTL_MS
    ) {
      if (matchingCache !== cacheState) {
        const nextCache = { ...matchingCache, key: cacheKey };
        setCacheState(nextCache);
        setStoryState({
          key: cacheKey,
          stories: getActiveStories(nextCache.stories, authorId),
        });
      }
      setLoading(false);
      setError("");
      return;
    }
    if (!stories.length) setLoading(true);
    try {
      const data = await storyService.list(authorId);
      saveStories(getArrayResults(data, "Stories"));
      setError("");
    } catch (loadError) {
      console.error("Stories could not be loaded:", loadError);
      setError(loadError.message || "Stories could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [authorId, cacheState, saveStories, stories.length]);

  const markViewedLocally = useCallback((event) => {
    const storyId = event.detail?.storyId;
    if (storyId == null) return;
    const currentStories = storiesRef.current;
    if (!currentStories.some((story) => (
      String(story.id) === String(storyId)
    ))) {
      return;
    }
    const updated = currentStories.map((story) => (
      String(story.id) === String(storyId)
        ? { ...story, is_seen: true }
        : story
    ));
    saveStories(
      updated,
      (cacheState?.key === cacheKey && cacheState.updatedAt) || Date.now()
    );
  }, [cacheKey, cacheState, saveStories]);

  useEffect(() => {
    void loadStories();
    const refresh = () => void loadStories({ force: true });
    window.addEventListener("ricehub:stories-updated", refresh);
    window.addEventListener("ricehub:story-viewed", markViewedLocally);
    return () => {
      window.removeEventListener("ricehub:stories-updated", refresh);
      window.removeEventListener("ricehub:story-viewed", markViewedLocally);
    };
  }, [loadStories, markViewedLocally]);

  useEffect(() => {
    if (!Array.isArray(initialStories) || cacheState) return;
    saveStories(initialStories);
  }, [cacheState, initialStories, saveStories]);

  const viewStory = useCallback(async (storyId) => {
    try {
      await storyService.markViewed(storyId);
      const updated = storiesRef.current.map((story) => (
        String(story.id) === String(storyId)
          ? { ...story, is_seen: true }
          : story
      ));
      saveStories(
        updated,
        (cacheState?.key === cacheKey && cacheState.updatedAt) || Date.now()
      );
    } catch (viewError) {
      console.error("Story view could not be recorded:", viewError);
      throw viewError;
    }
  }, [cacheKey, cacheState, saveStories]);

  return {
    stories,
    loading,
    error,
    reload: () => loadStories({ force: true }),
    viewStory,
  };
}
