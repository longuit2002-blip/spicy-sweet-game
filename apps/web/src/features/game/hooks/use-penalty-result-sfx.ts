"use client";

import { useEffect, useRef } from "react";
import type { PenaltyFxSnapshot } from "@/features/game/components/RoundResolutionFxOverlay";
import {
  isLocalChallengeLoser,
  isLocalChallengeWinner,
} from "@/features/game/lib/challenge-outcome-local";
import { playPenaltyResolutionSound } from "@/features/game/lib/game-reveal-sounds";
import { GAME_PHASE, type GamePhase } from "@/shared/types/game";

/**
 * One-shot impact SFX when the table enters `PENALTY` (after flights begin). Skipped when reduced motion is on.
 */
export function usePenaltyResultSfx(
  phase: GamePhase,
  penaltyFxSnapshot: PenaltyFxSnapshot | null,
  localPlayerId: string,
  reducedMotion: boolean,
): void {
  const lastKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (reducedMotion) return;
    if (phase !== GAME_PHASE.PENALTY || penaltyFxSnapshot == null) return;

    const r = penaltyFxSnapshot.result;
    const key = [
      r.challengerId,
      r.playerId,
      String(r.challengeCorrect),
      String(r.timedOut ?? false),
      String(penaltyFxSnapshot.pileCardCount),
    ].join("|");

    if (lastKeyRef.current === key) return;
    lastKeyRef.current = key;

    const lid = localPlayerId.trim();
    if (!lid) return;

    let role: "pile" | "draw" | "spectator";
    if (isLocalChallengeWinner(r, lid)) {
      role = "pile";
    } else if (isLocalChallengeLoser(r, lid)) {
      role = "draw";
    } else {
      role = "spectator";
    }

    const variant = r.challengeCorrect ? "caught" : r.timedOut ? "timeout" : "truth";
    void playPenaltyResolutionSound(role, variant);
  }, [phase, penaltyFxSnapshot, localPlayerId, reducedMotion]);
}
