import type { TFunction } from "i18next";
import { GAME_PHASE, type GamePhase } from "@/shared/types/game";

const PHASE_TO_I18N_KEY: Record<GamePhase, `phases.${string}`> = {
  [GAME_PHASE.LOBBY]: "phases.lobby",
  [GAME_PHASE.GAME_START]: "phases.gameStart",
  [GAME_PHASE.PLAYER_TURN]: "phases.playerTurn",
  [GAME_PHASE.CHALLENGE_PHASE]: "phases.challengePhase",
  [GAME_PHASE.REVEAL]: "phases.reveal",
  [GAME_PHASE.PENALTY]: "phases.penalty",
  [GAME_PHASE.TROPHY_AWARDED]: "phases.trophyAwarded",
  [GAME_PHASE.NEXT_TURN]: "phases.nextTurn",
  [GAME_PHASE.END_GAME]: "phases.endGame",
};

/** Localized short label for a `GamePhase` value (i18n namespace `game`). */
export function translateGamePhase(phase: GamePhase, t: TFunction<"game">): string {
  return t(PHASE_TO_I18N_KEY[phase]);
}
