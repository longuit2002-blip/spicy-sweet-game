import type { ChallengeType, Declaration, GameState, SpiceType } from "@sweet-spicy/shared-types";
import { claimChallenge, drawAndPassTurn, maxDeclarationRankForState, minDeclarationRankForState, playCard, resolveChallenge } from "./engine.js";

/** Display names for server / offline AI seats. */
export const LOBBY_BOT_DISPLAY_NAMES = ["Blaze", "Pepper", "Zesty", "Saffron", "Cinnamon"] as const;

/** Bot picks truthful declaration when random exceeds this (0..1). */
export const BOT_TRUTH_PLAY_THRESHOLD = 0.35;

/** Chance a bot uses draw-and-pass instead of playing (0..1); only when draw pile non-empty. */
export const BOT_DRAW_PASS_CHANCE = 0.12;

/** Non-declarer bot attempts to win claim race with this probability (once per challenge step). */
export const BOT_CLAIM_CHALLENGE_CHANCE = 0.55;

export function pickNextLobbyBotNickname(usedNicknames: readonly string[]): string {
  const used = new Set(usedNicknames.map((n) => n.toLowerCase()));
  for (const name of LOBBY_BOT_DISPLAY_NAMES) {
    if (!used.has(name.toLowerCase())) {
      return name;
    }
  }
  return `Bot ${usedNicknames.length + 1}`;
}

function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

function buildDeclarationForCard(
  state: GameState,
  randomCard: { number: number; type: SpiceType },
  locked: SpiceType | null,
): Declaration {
  const minDecl = minDeclarationRankForState(state);
  const maxDecl = maxDeclarationRankForState(state);
  const allTypes: SpiceType[] = ["chili", "lemon", "avocado"];

  const pickRankInBand = () => minDecl + Math.floor(Math.random() * (maxDecl - minDecl + 1));

  const suitForDecl = locked ?? allTypes[Math.floor(Math.random() * allTypes.length)]!;

  let declaration: Declaration;
  if (
    randomCard.number >= minDecl &&
    randomCard.number <= maxDecl &&
    Math.random() > BOT_TRUTH_PLAY_THRESHOLD
  ) {
    declaration = { type: suitForDecl, number: randomCard.number };
  } else {
    const num = pickRankInBand();
    const typePool = locked != null ? [locked] : allTypes;
    declaration = {
      type: typePool[Math.floor(Math.random() * typePool.length)]!,
      number: num,
    };
  }
  if (locked != null) {
    declaration = { ...declaration, type: locked };
  }
  return declaration;
}

/**
 * Applies one bot move for the current player when phase is PLAYER_TURN and they have `isBot`.
 */
export function applyBotPlayerTurnIfCurrentIsBot(state: GameState): GameState | null {
  if (state.phase !== "PLAYER_TURN") return null;
  const cp = state.players[state.currentPlayerIndex];
  if (!cp?.isBot || cp.hand.length === 0) return null;

  const tryDrawPass =
    state.drawPile.length > 0 && Math.random() < BOT_DRAW_PASS_CHANCE;
  if (tryDrawPass) {
    const drawn = drawAndPassTurn(state, cp.id);
    if (drawn) return drawn;
  }

  const locked = state.lockedSuit;
  const handOrder = shuffleInPlace([...cp.hand]);

  for (const randomCard of handOrder) {
    const declaration = buildDeclarationForCard(state, randomCard, locked);
    const next = playCard(state, cp.id, randomCard.id, declaration);
    if (next) return next;
  }

  if (state.drawPile.length > 0) {
    return drawAndPassTurn(state, cp.id);
  }

  return null;
}

export function pickBotChallengeType(): ChallengeType {
  return Math.random() > 0.5 ? "suit" : "number";
}

/**
 * One step of bot behavior during CHALLENGE_PHASE (claim or pick challenge type).
 */
export function applyBotChallengePhaseStep(state: GameState): GameState | null {
  if (state.phase !== "CHALLENGE_PHASE" || !state.playedCard) return null;

  if (state.challengeStep === "CLAIM_RACE" && state.challengeClaimHolderId == null) {
    const declarerId = state.playedCard.playerId;
    const candidates = state.players.filter((p) => p.id !== declarerId && p.isBot);
    shuffleInPlace(candidates);
    for (const p of candidates) {
      if (Math.random() < BOT_CLAIM_CHALLENGE_CHANCE) {
        const next = claimChallenge(state, p.id);
        if (next) return next;
      }
    }
    return null;
  }

  if (state.challengeStep === "PICK_TYPE" && state.challengeClaimHolderId != null) {
    const holderId = state.challengeClaimHolderId;
    const holder = state.players.find((p) => p.id === holderId);
    if (holder?.isBot) {
      return resolveChallenge(state, holderId, pickBotChallengeType());
    }
  }

  return null;
}
