"use client";

import { useEffect, useRef } from "react";
import type { ChallengeResult } from "@/shared/types/game";
import { GAME_PHASE, type GamePhase } from "@/shared/types/game";
import { isLocalChallengeLoser, isLocalChallengeWinner } from "@/features/game/lib/challenge-outcome-local";
import { playChallengeLoseSound, playChallengeWinSound } from "@/features/game/lib/game-reveal-sounds";

/**
 * One-shot win/lose stinger when REVEAL shows a challenge result for the local seat.
 * Skipped when {@link reducedMotion} is true (aligns with decorative FX).
 */
export function useChallengeRevealSfx(
  phase: GamePhase,
  challengeResult: ChallengeResult | null,
  localPlayerId: string,
  reducedMotion: boolean,
): void {
  const lastKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (reducedMotion) return;
    if (phase !== GAME_PHASE.REVEAL || challengeResult == null) return;

    const key = [
      challengeResult.realCard.id,
      challengeResult.challengeType,
      String(challengeResult.challengeCorrect),
      String(challengeResult.timedOut ?? false),
      challengeResult.challengerId,
      challengeResult.playerId,
    ].join("|");

    if (lastKeyRef.current === key) return;
    lastKeyRef.current = key;

    const lid = localPlayerId.trim();
    if (!lid) return;

    if (isLocalChallengeWinner(challengeResult, lid)) {
      void playChallengeWinSound();
    } else if (isLocalChallengeLoser(challengeResult, lid)) {
      void playChallengeLoseSound();
    }
  }, [phase, challengeResult, localPlayerId, reducedMotion]);
}
