import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Avatar from "../components/common/Avatar";
import ErrorState from "../components/common/ErrorState";
import Loader from "../components/common/Loader";
import searchService from "../services/searchService";
import userService from "../services/userService";
import { getArrayResults } from "../utils/arrayResults";
import useDebounce from "../hooks/useDebounce";
import { useLanguage } from "../context/LanguageContext";

export default function Search() {
  const { t } = useLanguage();
  const [params] = useSearchParams();
  const query = params.get("q") || "";
  const debouncedQuery = useDebounce(query, 350);
  const [users, setUsers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const normalizedQuery = debouncedQuery.trim();
    if (normalizedQuery.length < 2) {
      setUsers([]);
      setPosts([]);
      setError("");
      setLoading(false);
      return undefined;
    }

    let active = true;
    setLoading(true);
    setError("");
    Promise.all([
      userService.search(normalizedQuery),
      searchService.posts(normalizedQuery),
    ])
      .then(([userResults, postResults]) => {
        if (!active) return;
        setUsers(getArrayResults(userResults, "People search"));
        setPosts(getArrayResults(postResults, "Post search"));
      })
      .catch((searchError) => {
        if (!active) return;
        console.error("Search results could not be loaded:", searchError);
        setError(t("searchResultsLoadFailed"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [debouncedQuery, t]);

  return (
    <section className="search-page" aria-label={t("searchResults")}>
      {query.trim().length < 2 ? (
        <p className="search-page-prompt">{t("searchPeoplePosts")}</p>
      ) : loading ? (
        <Loader />
      ) : error ? (
        <ErrorState message={error} />
      ) : (
        <>
          <section className="search-result-group" aria-labelledby="people-results-title">
            <h1 id="people-results-title">{t("people")}</h1>
            {users.length ? users.map((person) => (
              <Link
                key={person.id}
                to={`/search/profile/${person.id}?q=${encodeURIComponent(query)}`}
                className="search-profile-result"
              >
                <Avatar user={person} />
                <span>
                  <strong>{[person.first_name, person.last_name].filter(Boolean).join(" ") || person.username}</strong>
                  <small>@{person.username}</small>
                </span>
              </Link>
            )) : <p className="muted">{t("noPeopleFound")}</p>}
          </section>
          <section className="search-result-group" aria-labelledby="post-results-title">
            <h2 id="post-results-title">{t("posts")}</h2>
            {posts.length ? posts.map((post) => (
              <Link
                key={post.id}
                to={`/search/posts/${post.id}?q=${encodeURIComponent(query)}`}
                className="search-post-result"
              >
                <strong>@{post.author?.username || t("riceHubMember")}</strong>
                <span>{post.content || t("photoVideoPost")}</span>
              </Link>
            )) : <p className="muted">{t("noPostsFound")}</p>}
          </section>
        </>
      )}
    </section>
  );
}
