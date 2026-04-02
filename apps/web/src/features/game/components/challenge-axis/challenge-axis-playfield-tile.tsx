"use client";

import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import {
  CHALLENGE_AXIS_TILE_ACTIVE_CLASS,
  CHALLENGE_AXIS_TILE_ACTIVE_PICK_MUTED_CLASS,
  CHALLENGE_AXIS_TILE_ICON_SIZE_PLAYFIELD,
  CHALLENGE_AXIS_TILE_INACTIVE_CLASS,
  CHALLENGE_AXIS_TILE_LABEL_MUTED_CLASS,
  CHALLENGE_AXIS_TILE_LABEL_PRIMARY_CLASS,
} from "./challenge-axis-tile-styles";

export type ChallengeAxisPlayfieldTileAxis = "suit" | "number";

/** Interactive chrome for holder pick buttons (touch ≥44px, focus ring). */
export const CHALLENGE_AXIS_PLAYFIELD_TILE_BUTTON_CLASS = cn(
  "w-full min-h-[44px] cursor-pointer",
  "hover:border-primary/55 hover:bg-primary/16 hover:shadow-md",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background",
  "motion-safe:active:scale-[0.98]",
);

/** Softer hover when the active surface is {@link CHALLENGE_AXIS_TILE_ACTIVE_PICK_MUTED_CLASS} (PICK holder). */
export const CHALLENGE_AXIS_PLAYFIELD_TILE_BUTTON_PICK_MUTED_HOVER_CLASS =
  "hover:border-primary/45 hover:bg-primary/8 hover:shadow-sm";

export interface ChallengeAxisPlayfieldTileProps {
  axis: ChallengeAxisPlayfieldTileAxis;
  /** `active` — chosen / tappable highlight; `inactive` — ghost / unchosen. */
  emphasis: "active" | "inactive";
  /**
   * `pickMuted` — embedded PICK holder: neutral card surface + primary accents only on icon/label.
   * `default` — stronger primary fill (REVEAL lock row, etc.).
   */
  activeEmphasisStyle?: "default" | "pickMuted";
  /** `button` — holder pick; `static` — spectator ghost + REVEAL lock row. */
  as?: "button" | "static";
  onClick?: () => void;
  /** Required when `as="button"`. */
  ariaLabel?: string;
  className?: string;
}

/**
 * Single “Sai vị” / “Sai số” face shared by embedded PICK (spectator + holder) and REVEAL lock row.
 */
export function ChallengeAxisPlayfieldTile({
  axis,
  emphasis,
  activeEmphasisStyle = "default",
  as = "static",
  onClick,
  ariaLabel,
  className,
}: ChallengeAxisPlayfieldTileProps) {
  const { t } = useTranslation("game");
  const isActive = emphasis === "active";
  const surfaceClass = isActive
    ? activeEmphasisStyle === "pickMuted"
      ? CHALLENGE_AXIS_TILE_ACTIVE_PICK_MUTED_CLASS
      : CHALLENGE_AXIS_TILE_ACTIVE_CLASS
    : CHALLENGE_AXIS_TILE_INACTIVE_CLASS;
  const labelText = axis === "suit" ? t("challenge.wrongSuit") : t("challenge.wrongNumber");
  const iconName = axis === "suit" ? "style" : "counter_1";

  const body = (
    <>
      <Icon
        name={iconName}
        size={CHALLENGE_AXIS_TILE_ICON_SIZE_PLAYFIELD}
        fill={1}
        className={cn("shrink-0", isActive ? "text-primary" : "text-muted-foreground")}
      />
      <span className={isActive ? CHALLENGE_AXIS_TILE_LABEL_PRIMARY_CLASS : CHALLENGE_AXIS_TILE_LABEL_MUTED_CLASS}>
        {labelText}
      </span>
    </>
  );

  if (as === "button") {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel}
        className={cn(
          surfaceClass,
          CHALLENGE_AXIS_PLAYFIELD_TILE_BUTTON_CLASS,
          isActive && activeEmphasisStyle === "pickMuted" && CHALLENGE_AXIS_PLAYFIELD_TILE_BUTTON_PICK_MUTED_HOVER_CLASS,
          className,
        )}
      >
        {body}
      </button>
    );
  }

  return <div className={cn(surfaceClass, className)}>{body}</div>;
}
