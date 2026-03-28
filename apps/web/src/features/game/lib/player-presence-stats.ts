import { computePlayerFinalScore } from "@sweet-spicy/game-logic";
import type { GamePlayer } from "@sweet-spicy/shared-types";
import { getPlayerHandCount, type Player } from "@/shared/types/game";

export function trophyCountFor(p: Player): number {
  return "trophyCount" in p ? p.trophyCount : 0;
}

export function scoreForPlayer(p: Player): number {
  if ("wonPileCount" in p) return p.score;
  return computePlayerFinalScore(p as GamePlayer);
}

export function playerPresenceStats(p: Player): {
  hand: number;
  score: number;
  trophies: number;
} {
  return {
    hand: getPlayerHandCount(p),
    score: scoreForPlayer(p),
    trophies: trophyCountFor(p),
  };
}
