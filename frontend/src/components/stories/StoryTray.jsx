import StoryStrip from "./StoryStrip";

export default function StoryTray({ currentUser }) {
  return (
    <StoryStrip
      currentUser={currentUser}
      showCreate
    />
  );
}
