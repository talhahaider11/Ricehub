import { useCallback, useEffect, useState } from "react";

import storyService from "../services/storyService";
import { getArrayResults } from "../utils/arrayResults";

export default function useStories(authorId) {
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadStories = useCallback(async () => {
    setLoading(true);
    try {
      const data = await storyService.list(authorId);
      setStories(getArrayResults(data, "Stories"));
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
