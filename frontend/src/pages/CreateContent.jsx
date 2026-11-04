import { useNavigate, useSearchParams } from "react-router-dom";
import CreatePost from "../components/posts/CreatePost";
import StoryUploader from "../components/stories/StoryUploader";
import useAuth from "../hooks/useAuth";

export default function CreateContent() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const type = ["post", "story", "reel"].includes(params.get("type"))
    ? params.get("type")
    : "post";

  if (type !== "story") {
    return (
      <div className="page-container create-content-page">
        <h1>Create {type}</h1>
        <CreatePost
          key={type}
          initialPostType={type}
          onCreateStory={() => navigate("/create?type=story")}
          onCreated={() => navigate(`/profile/${user.id}`)}
        />
      </div>
    );
  }

  return (
    <div className="page-container create-content-page">
      <StoryUploader onCreated={() => navigate(`/profile/${user.id}`)} />
    </div>
  );
}
