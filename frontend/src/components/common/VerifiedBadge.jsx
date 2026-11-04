import { BadgeCheck } from "lucide-react";

export default function VerifiedBadge({ verified = false }) {
  if (!verified) return null;
  return (
    <BadgeCheck
      className="verified-badge"
      size={18}
      fill="currentColor"
      aria-label="Verified account"
      title="Verified account"
    />
  );
}
