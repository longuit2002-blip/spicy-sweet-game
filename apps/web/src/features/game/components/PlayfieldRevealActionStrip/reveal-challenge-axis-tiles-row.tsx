"use client";

import type { ChallengeResult } from "@/shared/types/game";
import { cn } from "@/lib/utils";
import {
  CHALLENGE_AXIS_TILE_COL_CLASS,
  CHALLENGE_AXIS_TILE_REVEAL_INACTIVE_WRAP_CLASS,
  CHALLENGE_AXIS_TILE_ROW_CLASS,
  ChallengeAxisPlayfieldTile,
} from "@/features/game/components/challenge-axis";

/**
 * Wrong-suit vs wrong-number pair during REVEAL lock — same tile face as embedded PICK.
 */
export function RevealChallengeAxisTilesRow({
  challengeType,
  className,
}: {
  challengeType: ChallengeResult["challengeType"];
  className?: string;
}) {
  const suitChosen = challengeType === "suit";

  return (
    <div className={cn(CHALLENGE_AXIS_TILE_ROW_CLASS, "h-full min-h-0", className)} aria-hidden>
      <div className={cn(CHALLENGE_AXIS_TILE_COL_CLASS, !suitChosen && CHALLENGE_AXIS_TILE_REVEAL_INACTIVE_WRAP_CLASS)}>
        <ChallengeAxisPlayfieldTile axis="suit" emphasis={suitChosen ? "active" : "inactive"} />
      </div>
      <div className={cn(CHALLENGE_AXIS_TILE_COL_CLASS, suitChosen && CHALLENGE_AXIS_TILE_REVEAL_INACTIVE_WRAP_CLASS)}>
        <ChallengeAxisPlayfieldTile axis="number" emphasis={!suitChosen ? "active" : "inactive"} />
      </div>
    </div>
  );
}
