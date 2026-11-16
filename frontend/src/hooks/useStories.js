import { useCallback, useEffect, useState } from "react";

import storyService from "../services/storyService";
import { getArrayResults } from "../utils/arrayResults";

const STORY_LIFETIME_MS = 24 * 60 * 60 * 1000;

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

export default function useStories(authorId, initialStories = []) {
  const [stories, setStories] = useState(() => (
    getActiveStories(
      Array.isArray(initialStories) ? initialStories : [],
      authorId
    )
  ));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadStories = useCallback(async () => {
    setLoading(true);
    try {
      const data = await storyService.list(authorId);
      setStories(getActiveStories(
        getArrayResults(data, "Stories"),
        authorId
      ));
      setError("");
    } catch (loadError) {
      console.error("Stories could not be loaded:", loadError);
      setError("Stories could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [authorId]);

  const markViewedLocally = useCallback((event) => {
    const storyId = event.detail?.storyId;
    if (storyId == null) return;
    setStories((current) => current.map((story) => (
      String(story.id) === String(storyId)
        ? { ...story, is_seen: true }
        : story
    )));
  }, []);

  useEffect(() => {
    void loadStories();
    const refresh = () => void loadStories();
    window.addEventListener("ricehub:stories-updated", refresh);
    window.addEventListener("ricehub:story-viewed", markViewedLocally);
    return () => {
      window.removeEventListener("ricehub:stories-updated", refresh);
      window.removeEventListener("ricehub:story-viewed", markViewedLocally);
    };
  }, [loadStories, markViewedLocally]);

  const viewStory = useCallback(async (storyId) => {
    try {
      await storyService.markViewed(storyId);
      setStories((current) =>
        current.map((story) =>
          story.id === storyId ? { ...story, is_seen: true } : story
        )
      );
    } catch (viewError) {
      console.error("Story view could not be recorded:", viewError);
      throw viewError;
    }
  }, []);

  return {
    stories,
    loading,
    error,
    reload: loadStories,
    viewStory,
  };
}
