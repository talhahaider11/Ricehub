import React, { useState } from "react";
import { getMediaUrl } from "../../utils/constants";

export default function Avatar({
  src,
  name,
  user,
  size = 42,
}) {
  const [imageError, setImageError] = useState(false);

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
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const formattedImageSrc = imageSrc ? getMediaUrl(imageSrc) : null;

  return (
    <div
      className={`avatar${typeof size === "string" ? ` avatar-${size}` : ""}`}
      style={{
        width: dimensions,
        height: dimensions,
        minWidth: dimensions,
        minHeight: dimensions,
        borderRadius: "50%",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
      aria-label={`${displayName}'s profile`}
      role="img"
    >
      {formattedImageSrc && !imageError ? (
        <img
          src={formattedImageSrc}
          alt={displayName}
          onError={() => setImageError(true)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      ) : (
        <span aria-hidden="true" className="avatar-initials">
          {initials}
        </span>
      )}
    </div>
  );
}