import StoryTray from "../components/stories/StoryTray";
import useAuth from "../hooks/useAuth";

export default function Stories() {
  const { user } = useAuth();

  return (
    <main className="page-container stories-page">
      <StoryTray currentUser={user} />
    </main>
  );
}
