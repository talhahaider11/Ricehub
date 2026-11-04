import { NavLink } from "react-router-dom";

export default function FeedTabs() {
  return (
    <nav className="feed-tabs" aria-label="Feed">
      <NavLink to="/" end>Following</NavLink>
      <NavLink to="/for-you">For You</NavLink>
    </nav>
  );
}
