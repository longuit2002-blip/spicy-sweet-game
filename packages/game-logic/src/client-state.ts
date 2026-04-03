import type {
  ClientGameState,
  ClientGamePlayer,
  ClientPlayedCard,
  GameState,
  GamePlayer,
} from "@sweet-spicy/shared-types";
import { computePlayerFinalScore } from "./engine.js";

function toClientPlayer(p: GamePlayer, viewerPlayerId: string): ClientGamePlayer {
  const isSelf = p.id === viewerPlayerId;
  return {
    id: p.id,
    nickname: p.nickname,
    hand: isSelf ? p.hand : [],
    handCount: p.hand.length,
    wonPileCount: p.wonPile.length,
    trophyCount: p.trophyCount,
    score: computePlayerFinalScore(p),
    isReady: p.isReady,
    isHost: p.isHost,
    ...(p.isBot === true ? { isBot: true as const } : {}),
  };
}

function maskWinnerPlayer(p: GamePlayer, viewerPlayerId: string): GamePlayer {
  if (p.id === viewerPlayerId) return { ...p };
  return { ...p, hand: [], wonPile: [] };
}

/**
 * Server-side view of game state for a single client. Hides opponents' hands,
 * won piles, table pile contents, draw pile, and the real played card during CHALLENGE_PHASE.
 */
export function toClientGameState(gs: GameState, viewerPlayerId: string): ClientGameState {
  const players: ClientGamePlayer[] = gs.players.map((p) => toClientPlayer(p, viewerPlayerId));

  let playedCard: ClientPlayedCard | null = null;
  if (gs.playedCard) {
    const hideRealCard = gs.phase === "CHALLENGE_PHASE";
    playedCard = {
      declaration: gs.playedCard.declaration,
      playerId: gs.playedCard.playerId,
      card: hideRealCard ? null : gs.playedCard.card,
    };
  }

  return {
    phase: gs.phase,
    players,
    currentPlayerIndex: gs.currentPlayerIndex,
    drawPileCount: gs.drawPile.length,
    tablePileCount: gs.tablePile.length,
    lockedSuit: gs.lockedSuit,
    supremeReserve: gs.supremeReserve,
    trophiesRemaining: gs.trophiesRemaining,
    playedCard,
    challengeResult: gs.challengeResult,
    challengeTimer: gs.challengeTimer,
    challengeStep: gs.challengeStep,
    challengeClaimHolderId: gs.challengeClaimHolderId,
    challengePassIds: gs.challengePassIds,
    lastResolvedDeclaration: gs.lastResolvedDeclaration,
    winner: gs.winner ? maskWinnerPlayer(gs.winner, viewerPlayerId) : null,
    winners: gs.winners.map((w) => maskWinnerPlayer(w, viewerPlayerId)),
    roomCode: gs.roomCode,
  };
}

/** Running score for leaderboard during play (same formula as endgame, including hand penalty). */
export function getVisiblePlayerScore(p: GamePlayer): number {
  return computePlayerFinalScore(p);
}
