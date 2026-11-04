import { Link } from "react-router-dom";

export default function TrendingCard({ hashtag }) {
  return (
    <Link
      to={`/hashtag/${encodeURIComponent(hashtag.name)}`}
      className="search-user"
    >
      <strong>#{hashtag.name}</strong>
      <span>{hashtag.post_count} posts</span>
    </Link>
  );
}
