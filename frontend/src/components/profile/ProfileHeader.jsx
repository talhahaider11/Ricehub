import {
  Link,
} from "react-router-dom";

import Avatar from "../common/Avatar";
import Button from "../common/Button";
import { getMediaUrl } from "../../utils/constants";

export default function ProfileHeader({
  profile,
  isOwnProfile = false,
  onAddFriend,
}) {
  return (
    <section className="profile-cover">
      <div className="cover-image">
        {profile.cover_picture && (
          <img
            src={
              getMediaUrl(profile.cover_picture)
            }
            alt=""
          />
        )}
      </div>

      <div className="profile-header-content">
        <Avatar
          src={
            profile.profile_picture
          }
          username={
            profile.username
          }
          size="large"
          online={
            profile.is_online
          }
        />

        <div className="profile-main-info">
          <h1>
            {profile.first_name ||
            profile.last_name
              ? `${profile.first_name || ""} ${
                  profile.last_name || ""
                }`.trim()
              : profile.username}
          </h1>

          <p className="username">
            @{profile.username}
          </p>

          {profile.bio && (
            <p className="bio">
              {profile.bio}
            </p>
          )}

          <div className="profile-stats">
            <span>
              <strong>
                {profile.posts_count ||
                  0}
              </strong>{" "}
              Posts
            </span>

            <span>
              <strong>
                {profile.friends_count ||
                  0}
              </strong>{" "}
              Friends
            </span>
          </div>
        </div>

        <div className="profile-actions">
          {isOwnProfile ? (
            <Link to="/profile/edit">
              <Button>
                Edit Profile
              </Button>
            </Link>
          ) : (
            <Button
              onClick={onAddFriend}
            >
              Add Friend
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}