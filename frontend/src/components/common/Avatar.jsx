import { getMediaUrl } from "../../utils/constants";

export default function Avatar({
  src,
  name,
  user,
  size = 42,
}) {
  const displayName =
    name ||
    [user?.first_name, user?.last_name].filter(Boolean).join(" ") ||
    user?.username ||
    "User";
  const imageSrc = src ?? user?.profile_picture;
  const dimensions =
    typeof size === "number"
      ? size
      : { small: 34, medium: 44, large: 90 }[size] || 42;
  const initials = displayName
   .split(" ")
   .map((part) => part[0])
   .join("")
   .slice(0, 2)
   .toUpperCase();

  return (
    <div
      className={`avatar${typeof size === "string" ? ` avatar-${size}` : ""}`}
      style={{
        width: dimensions,
        height: dimensions,
      }}
      aria-label={`${displayName}'s profile`}
      role="img"
    >
      {imageSrc ? (
        <img
          src={getMediaUrl(imageSrc)}
          alt=""
        />
      ) : (
        <span aria-hidden="true">{initials}</span>
      )}
    </div>
  );
}