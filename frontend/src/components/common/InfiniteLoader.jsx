import { useEffect, useRef } from "react";

export default function InfiniteLoader({
  onLoadMore,
  hasMore,
  loading,
}) {
  const ref = useRef(null);

  useEffect(() => {
    const element = ref.current;

    if (!element) return;

    const observer =
      new IntersectionObserver(
        (entries) => {
          if (
            entries[0].isIntersecting &&
            hasMore &&
            !loading
          ) {
            onLoadMore();
          }
        },
        {
          rootMargin: "300px",
        }
      );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [
    onLoadMore,
    hasMore,
    loading,
  ]);

  return (
    <div
      ref={ref}
      className="infinite-loader"
    >
      {loading && "Loading more posts..."}
      {!hasMore &&
        "You've reached the end."}
    </div>
  );
}