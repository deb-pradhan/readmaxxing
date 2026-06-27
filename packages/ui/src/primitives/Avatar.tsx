import * as React from "react";
import { cn } from "../cn";

export interface AvatarProps {
  /** Display name — used to derive initials if no image. */
  name?: string | null;
  /** Image source. Falls back to initials when missing or fails. */
  src?: string | null;
  /** Visual size. */
  size?: 32 | 40 | 56;
  /** Whether to render the online status dot. */
  online?: boolean;
  className?: string;
}

const sizeClasses: Record<NonNullable<AvatarProps["size"]>, string> = {
  32: "h-8 w-8 text-xs",
  40: "h-10 w-10 text-sm",
  56: "h-14 w-14 text-md",
};

const dotSizeClasses: Record<NonNullable<AvatarProps["size"]>, string> = {
  32: "h-2 w-2",
  40: "h-2.5 w-2.5",
  56: "h-3 w-3",
};

const BG_VARIANTS = ["bg-coral-bg", "bg-butter-bg", "bg-lavender-bg", "bg-mint-bg"] as const;

function initials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function pickBg(name?: string | null): string {
  if (!name) return BG_VARIANTS[0]!;
  const sum = [...name].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return BG_VARIANTS[sum % BG_VARIANTS.length]!;
}

/**
 * Avatar — DESIGN-SYSTEM §11.7. Slightly rounded square (10px), with
 * image or initials on a tinted background. Optional online dot in
 * the bottom-right.
 */
export const Avatar: React.FC<AvatarProps> = ({
  name,
  src,
  size = 40,
  online = false,
  className,
}) => {
  const [errored, setErrored] = React.useState(false);
  const showImage = src && !errored;
  return (
    <div
      role="img"
      aria-label={name ? `${name} avatar` : "avatar"}
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[10px] font-semibold text-white",
        sizeClasses[size],
        showImage ? "" : pickBg(name),
        className,
      )}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src ?? undefined}
          alt=""
          onError={() => setErrored(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <span aria-hidden>{initials(name)}</span>
      )}
      {online ? (
        <span
          aria-hidden
          className={cn(
            "absolute bottom-0 right-0 rounded-full border-2 border-card bg-success",
            dotSizeClasses[size],
          )}
        />
      ) : null}
    </div>
  );
};

Avatar.displayName = "Avatar";