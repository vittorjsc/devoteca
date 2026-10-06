"use client";
import { useEffect, useState } from "react";
export const mediaUrl = (id: string) =>
  "/api/community/media?id=" + encodeURIComponent(id);
export function CommunityAvatar({
  name,
  imageId,
  size = "normal",
}: {
  name: string;
  imageId?: string | null;
  size?: "normal" | "small" | "large";
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [imageId]);
  const initials = name
    .split(/[ @._]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
  return (
    <span className={"community-avatar " + size} aria-hidden="true">
      {imageId && !failed ? (
        <img src={mediaUrl(imageId)} alt="" onError={() => setFailed(true)} />
      ) : (
        initials
      )}
    </span>
  );
}
