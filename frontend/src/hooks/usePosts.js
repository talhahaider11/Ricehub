import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import postService from "../services/postService";
import { getArrayResults } from "../utils/arrayResults";

export default function usePosts(sort = "recent") {
  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadingRef = useRef(false);
  const requestRef = useRef(0);

  const loadPosts = useCallback(
    async (pageNumber = 1) => {
      const requestId = ++requestRef.current;
      loadingRef.current = true;
      setLoading(true);
      setError(null);

      try {
        const data = await postService.list(pageNumber, sort);
        if (requestId !== requestRef.current) return;
        const results = getArrayResults(data, "Posts");

        setPosts((current) =>
          pageNumber === 1? results : [...current,...results]
        );
        setPage(pageNumber);
        setHasMore(Boolean(data.next));
      } catch (err) {
        if (requestId === requestRef.current) {
          setError(err.message || "Failed to load posts");
        }
      } finally {
        if (requestId === requestRef.current) {
          loadingRef.current = false;
          setLoading(false);
        }
      }
    },
    [sort]
  );

  useEffect(() => {
    loadPosts(1);
  }, [loadPosts]);

  const loadMore = () => {
    if (!loadingRef.current && hasMore) {
      loadPosts(page + 1);
    }
  };

  const addPost = (post) => setPosts((c) => [post,...c]);
  const removePost = (id) => setPosts((c) => c.filter((p) => p.id!== id));
  const updatePost = (updated) =>
    setPosts((c) => c.map((p) => (p.id === updated.id? updated : p)));

  return {
    posts,
    loading,
    error,
    hasMore,
    loadMore,
    loadPosts,
    addPost,
    removePost,
    updatePost,
  };
}