"use client";

import { useEffect, useRef } from "react";
import { GAME_PHASE, type GamePhase } from "@/shared/types/game";
import { playTurnHandoffStinger } from "@/features/game/lib/game-reveal-sounds";

/**
 * One-shot stinger when the table advances turn (NEXT_TURN pause or new `PLAYER_TURN` actor).
 * Skipped when {@link reducedMotion} is true (matches challenge reveal SFX).
 */
export function useOpponentTurnSfx(
  phase: GamePhase,
  currentPlayerIndex: number,
  reducedMotion: boolean,
): void {
  const prevPhaseRef = useRef<GamePhase>(phase);
  const prevPlayerIndexRef = useRef(currentPlayerIndex);

  useEffect(() => {
    if (reducedMotion) {
      prevPhaseRef.current = phase;
      if (phase === GAME_PHASE.PLAYER_TURN) prevPlayerIndexRef.current = currentPlayerIndex;
      return;
    }

    const prevPhase = prevPhaseRef.current;
    const prevIdx = prevPlayerIndexRef.current;

    if (phase === GAME_PHASE.NEXT_TURN && prevPhase !== GAME_PHASE.NEXT_TURN) {
      void playTurnHandoffStinger();
    } else if (
      phase === GAME_PHASE.PLAYER_TURN &&
      prevPhase === GAME_PHASE.PLAYER_TURN &&
      currentPlayerIndex !== prevIdx
    ) {
      void playTurnHandoffStinger();
    }

    prevPhaseRef.current = phase;
    if (phase === GAME_PHASE.PLAYER_TURN) prevPlayerIndexRef.current = currentPlayerIndex;
  }, [phase, currentPlayerIndex, reducedMotion]);
}
