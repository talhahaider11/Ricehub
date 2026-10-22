export default function ProfileInfo({
  profile,
}) {
  return (
    <section className="profile-info-card">
      <h2>About</h2>

      <div className="profile-detail">
        <span>Username</span>
        <strong>
          @{profile.username}
        </strong>
      </div>

      {profile.email && (
        <div className="profile-detail">
          <span>Email</span>
          <strong>
            {profile.email}
          </strong>
        </div>
      )}

      {profile.location && (
        <div className="profile-detail">
          <span>Location</span>
          <strong>
            {profile.location}
          </strong>
        </div>
      )}
    </section>
  );
}