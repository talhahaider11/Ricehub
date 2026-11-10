import { NavLink } from "react-router-dom";
import { useLanguage } from "../../context/LanguageContext";

export default function FeedTabs() {
  const { t } = useLanguage();

  return (
    <nav className="feed-tabs" aria-label={t("feed")}>
      <NavLink to="/" end>{t("following")}</NavLink>
      <NavLink to="/for-you">{t("forYou")}</NavLink>
    </nav>
  );
}
