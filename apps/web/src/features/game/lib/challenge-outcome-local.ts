import type { ChallengeResult } from "@/shared/types/game";

/**
 * Seats that lose the round from the challenge resolution:
 * - Bluff caught → declarer (`playerId`) lied.
 * - Wrong challenge, pick timeout, or truth on challenge → challenger (`challengerId`) pays.
 */
export function isLocalChallengeLoser(result: ChallengeResult, localPlayerId: string): boolean {
  const lid = localPlayerId.trim();
  if (!lid) return false;
  if (result.challengeCorrect) {
    return result.playerId === lid;
  }
  return result.challengerId === lid;
}

/** Round winner for the table pile / resolution (the other seat vs {@link isLocalChallengeLoser}). */
export function isLocalChallengeWinner(result: ChallengeResult, localPlayerId: string): boolean {
  const lid = localPlayerId.trim();
  if (!lid) return false;
  if (result.challengeCorrect) {
    return result.challengerId === lid;
  }
  return result.playerId === lid;
}
