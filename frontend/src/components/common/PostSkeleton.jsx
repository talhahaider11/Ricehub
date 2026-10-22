import Skeleton from "./Skeleton";

export default function PostSkeleton() {
  return (
    <article className="card post-card" aria-hidden="true">
      <div className="post-header">
        <div className="post-author">
          <Skeleton width={40} height={40} radius="50%" />
          <div>
            <Skeleton width={120} height={14} />
            <Skeleton width={84} height={12} />
          </div>
        </div>
        <Skeleton width={24} height={24} radius="50%" />
      </div>

      <div className="post-content">
        <Skeleton height={14} />
        <Skeleton width="72%" height={14} />
      </div>

      <div className="post-stats">
        <Skeleton width={72} height={12} />
        <Skeleton width={96} height={12} />
      </div>

      <div className="post-actions">
        <Skeleton width="48%" height={38} />
        <Skeleton width="48%" height={38} />
      </div>
    </article>
  );
}