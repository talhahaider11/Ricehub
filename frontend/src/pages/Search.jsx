import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Avatar from "../components/common/Avatar";
import ErrorState from "../components/common/ErrorState";
import Loader from "../components/common/Loader";
import { useLanguage } from "../context/LanguageContext";
import useDebounce from "../hooks/useDebounce";
import searchService from "../services/searchService";
import { getArrayResults } from "../utils/arrayResults";

const EMPTY_RESULTS = {
  users: [],
  posts: [],
  groups: [],
  hashtags: [],
};

function getPostThumbnail(post) {
  const asset = post.media_assets?.find(
    (item) => item.processing_status !== "failed"
  );
  return (
    asset?.thumbnail_url ||
    (asset?.media_type === "image" ? asset.url : null) ||
    post.image ||
    null
  );
}

export default function Search() {
  const { t } = useLanguage();
  const [params] = useSearchParams();
  const query = params.get("q") || "";
  const debouncedQuery = useDebounce(query, 350);
  const [results, setResults] = useState(EMPTY_RESULTS);
  const [category, setCategory] = useState("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const normalizedQuery = debouncedQuery.trim();
    if (normalizedQuery.length < 2) {
      setResults(EMPTY_RESULTS);
      setError("");
      setLoading(false);
      return undefined;
    }

    let active = true;
    setLoading(true);
    setError("");
    searchService.global(normalizedQuery)
      .then((response) => {
        if (!active) return;
        if (!response || typeof response !== "object" || Array.isArray(response)) {
          throw new TypeError("Global search response was not an object.");
        }
        setResults({
          users: getArrayResults(response.users, "Account search"),
          posts: getArrayResults(response.posts, "Post search"),
          groups: getArrayResults(response.groups, "Group search"),
          hashtags: getArrayResults(response.hashtags, "Hashtag search"),
        });
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

  const posts = results.posts.filter((post) => post.post_type !== "reel");
  const reels = results.posts.filter((post) => post.post_type === "reel");
  const categories = [
    { key: "accounts", label: t("searchAccounts"), items: results.users },
    { key: "posts", label: t("posts"), items: posts },
    { key: "reels", label: t("searchReels"), items: reels },
    { key: "groups", label: t("searchGroups"), items: results.groups },
    { key: "hashtags", label: t("searchHashtags"), items: results.hashtags },
  ];
  const totalResults = categories.reduce(
    (total, resultCategory) => total + resultCategory.items.length,
    0
  );
  const visibleCategories = category === "all"
    ? categories.filter((resultCategory) => resultCategory.items.length > 0)
    : categories.filter((resultCategory) => resultCategory.key === category);

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
          <nav className="search-result-tabs" aria-label={t("searchResultCategories")}>
            <button
              type="button"
              className="search-result-tab"
              aria-pressed={category === "all"}
              onClick={() => setCategory("all")}
            >
              {t("searchAll")}
              <span>{totalResults}</span>
            </button>
            {categories.map((resultCategory) => (
              <button
                key={resultCategory.key}
                type="button"
                className="search-result-tab"
                aria-pressed={category === resultCategory.key}
                onClick={() => setCategory(resultCategory.key)}
              >
                {resultCategory.label}
                <span>{resultCategory.items.length}</span>
              </button>
            ))}
          </nav>

          {totalResults === 0 ? (
            <p className="search-page-empty">{t("searchNoResults")}</p>
          ) : (
            <div className="search-results">
              {visibleCategories.map((resultCategory) => (
                <section
                  key={resultCategory.key}
                  className="search-result-group"
                  aria-labelledby={`search-${resultCategory.key}-title`}
                >
                  <h2 id={`search-${resultCategory.key}-title`}>
                    {resultCategory.label}
                  </h2>
                  {resultCategory.items.length === 0 ? (
                    <p className="muted">{t("searchCategoryNoResults")}</p>
                  ) : resultCategory.key === "accounts" ? (
                    resultCategory.items.map((person) => (
                      <Link
                        key={person.id}
                        to={`/search/profile/${person.id}?q=${encodeURIComponent(query)}`}
                        className="search-profile-result"
                      >
                        <Avatar user={person} />
                        <span>
                          <strong>
                            {[person.first_name, person.last_name].filter(Boolean).join(" ") ||
                              person.username}
                          </strong>
                          <small>@{person.username}</small>
                        </span>
                      </Link>
                    ))
                  ) : resultCategory.key === "posts" || resultCategory.key === "reels" ? (
                    resultCategory.items.map((post) => {
                      const thumbnail = getPostThumbnail(post);
                      return (
                        <Link
                          key={post.id}
                          to={`/search/posts/${post.id}?q=${encodeURIComponent(query)}`}
                          className="search-post-result"
                        >
                          {thumbnail ? (
                            <img
                              className="search-result-thumbnail"
                              src={thumbnail}
                              alt=""
                              aria-hidden="true"
                              loading="lazy"
                            />
                          ) : (
                            <span className="search-result-thumbnail search-result-thumbnail-placeholder">
                              {post.post_type === "reel" ? t("searchReels") : t("posts")}
                            </span>
                          )}
                          <span className="search-post-result-content">
                            <strong>@{post.author?.username || t("riceHubMember")}</strong>
                            <span>{post.content || t("photoVideoPost")}</span>
                            <small>
                              {post.post_type === "reel" ? t("searchReels") : t("posts")}
                            </small>
                          </span>
                        </Link>
                      );
                    })
                  ) : resultCategory.key === "groups" ? (
                    resultCategory.items.map((group) => (
                      <article key={group.id} className="search-group-result">
                        <strong>{group.name}</strong>
                        {group.description && <span>{group.description}</span>}
                      </article>
                    ))
                  ) : (
                    resultCategory.items.map((hashtag) => (
                      <Link
                        key={hashtag.id}
                        to={`/hashtag/${encodeURIComponent(hashtag.name)}`}
                        className="search-hashtag-result"
                      >
                        <strong>#{hashtag.name}</strong>
                        <span>
                          {hashtag.post_count} {t("posts").toLowerCase()}
                        </span>
                      </Link>
                    ))
                  )}
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
