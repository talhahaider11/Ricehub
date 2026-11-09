import { Link } from "react-router-dom";
import SearchBar from "../components/navbar/SearchBar";
import PageTransition from "../components/common/PageTransition";

export default function SearchLayout() {
  return (
    <div className="search-experience">
      <header className="search-experience-header">
        <Link to="/" className="search-experience-brand">
          <img src="/ricehub-logo.jpg" alt="RiceHub" />
          <span>Rice Hub</span>
        </Link>
        <SearchBar />
      </header>
      <main className="search-experience-content">
        <PageTransition />
      </main>
      <footer className="search-experience-footer">
        <span>RiceHub · Connect · Share · Belong</span>
        <Link to="/help-support">Help &amp; Support</Link>
      </footer>
    </div>
  );
}
