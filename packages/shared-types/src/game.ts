export type SpiceType = "chili" | "lemon" | "avocado";

export type CardKind = "normal" | "wild-suit" | "wild-number" | "total-wild" | "trophy";

export interface GameCard {
  id: string;
  kind: CardKind;
  /** Meaningful for normal, wild-number, and display; ignored for suit checks on wild-suit / total-wild. */
  type: SpiceType;
  /** Meaningful for normal, wild-suit, and display; ignored for number checks on wild-number / total-wild. */
  number: number;
}

export interface Declaration {
  type: SpiceType;
  number: number;
}

export type ChallengeType = "suit" | "number";

/** Sub-step while `phase === CHALLENGE_PHASE`: race to claim, then holder picks suit vs number. */
export type ChallengeStep = "CLAIM_RACE" | "PICK_TYPE";

/** Full player model used in game state */
export interface GamePlayer {
  id: string;
  nickname: string;
  hand: GameCard[];
  /** Face-down pile won from challenges; contents hidden from opponents until endgame. */
  wonPile: GameCard[];
  /** Trophy cards claimed (+10 each at scoring). */
  trophyCount: number;
  isReady: boolean;
  isHost?: boolean;
  isBot?: boolean;
}

/** Single source of truth for phase literals — use instead of raw strings in comparisons. */
export const GAME_PHASE = {
  LOBBY: "LOBBY",
  GAME_START: "GAME_START",
  PLAYER_TURN: "PLAYER_TURN",
  CHALLENGE_PHASE: "CHALLENGE_PHASE",
  /** Total Wild was played: public resolve (no challenge), then table accept. */
  SUPREME_RESOLVE: "SUPREME_RESOLVE",
  REVEAL: "REVEAL",
  PENALTY: "PENALTY",
  TROPHY_AWARDED: "TROPHY_AWARDED",
  NEXT_TURN: "NEXT_TURN",
  END_GAME: "END_GAME",
} as const;

export type GamePhase = (typeof GAME_PHASE)[keyof typeof GAME_PHASE];

export interface PlayedCard {
  card: GameCard;
  declaration: Declaration;
  playerId: string;
}

export interface ChallengeResult {
  /**
   * From `game-logic` / `isChallengeCorrect`: **`true`** = the real card does **not** match the
   * declaration on the **challenged** attribute (bluff caught) → challenger wins the table pile and
   * the declarer draws the penalty from the deck. **`false`** = the card matches that attribute
   * (truth on the challenge) → declarer wins the table pile and the challenger draws the penalty
   * (see `applyPenalty`).
   */
  challengeCorrect: boolean;
  challengeType: ChallengeType;
  challengerId: string;
  playerId: string;
  realCard: GameCard;
  declaredCard: Declaration;
  /** True when the holder failed to pick before the pick timer expired (treated as incorrect challenge). */
  timedOut?: boolean;
}

export interface GameState {
  phase: GamePhase;
  players: GamePlayer[];
  currentPlayerIndex: number;
  drawPile: GameCard[];
  /** Face-down cards played this round before the current play (excludes `playedCard`). */
  tablePile: GameCard[];
  /** Suit locked for the current round; set by first declaration after a round reset. */
  lockedSuit: SpiceType | null;
  /** Total Wild cards left beside the draw pile for recovery draws. */
  supremeReserve: number;
  /** Trophy cards still available in the center (starts at 3). */
  trophiesRemaining: number;
  playedCard: PlayedCard | null;
  challengeResult: ChallengeResult | null;
  challengeTimer: number;
  /** Meaningful when `phase === CHALLENGE_PHASE`; otherwise `null`. */
  challengeStep: ChallengeStep | null;
  /** Player id holding challenge rights after winning the claim race; `null` during race or when not in challenge. */
  challengeClaimHolderId: string | null;
  /**
   * During `CHALLENGE_PHASE` + `CLAIM_RACE`, players (except the declarer) who tapped skip / pass.
   * When all eligible players are in this list, the declaration is accepted early.
   */
  challengePassIds: string[];
  /** Last declaration used for rank escalation within the locked suit. */
  lastResolvedDeclaration: Declaration | null;
  winner: GamePlayer | null;
  /** All players tied for highest score when the game ends (empty if not END_GAME). */
  winners: GamePlayer[];
  roomCode: string;
}

/** Opponent hands are empty; use {@link ClientGamePlayer.handCount}. */
export interface ClientGamePlayer {
  id: string;
  nickname: string;
  hand: GameCard[];
  handCount: number;
  wonPileCount: number;
  trophyCount: number;
  /** Running total (same formula as endgame scoring). */
  score: number;
  isReady: boolean;
  isHost?: boolean;
  isBot?: boolean;
}

/** During CHALLENGE_PHASE the real card is null until reveal; visible during SUPREME_RESOLVE. */
export interface ClientPlayedCard {
  declaration: Declaration;
  playerId: string;
  card: GameCard | null;
}

/**
 * Socket-safe game snapshot: no draw pile contents, masked hands, hidden real card during challenge.
 */
export interface ClientGameState {
  phase: GamePhase;
  players: ClientGamePlayer[];
  currentPlayerIndex: number;
  drawPileCount: number;
  tablePileCount: number;
  lockedSuit: SpiceType | null;
  supremeReserve: number;
  trophiesRemaining: number;
  playedCard: ClientPlayedCard | null;
  challengeResult: ChallengeResult | null;
  challengeTimer: number;
  challengeStep: ChallengeStep | null;
  challengeClaimHolderId: string | null;
  /** Same as server `GameState.challengePassIds` during claim race. */
  challengePassIds: string[];
  lastResolvedDeclaration: Declaration | null;
  winner: GamePlayer | null;
  winners: GamePlayer[];
  roomCode: string;
}

export function getPlayerHandCount(p: GamePlayer | ClientGamePlayer): number {
  if ("handCount" in p && typeof p.handCount === "number") {
    return p.handCount;
  }
  return p.hand.length;
}

export function isClientGameState(gs: GameState | ClientGameState): gs is ClientGameState {
  return "drawPileCount" in gs && !("drawPile" in gs);
}

export function getDrawPileCount(gs: GameState | ClientGameState): number {
  if (isClientGameState(gs)) {
    return gs.drawPileCount;
  }
  return gs.drawPile.length;
}

export function isWildCardKind(kind: CardKind): boolean {
  return kind === "wild-suit" || kind === "wild-number" || kind === "total-wild";
}

export const SPICE_EMOJI: Record<SpiceType, string> = {
  chili: "🌶️",
  lemon: "🍋",
  avocado: "🥑",
};

export const SPICE_LABEL: Record<SpiceType, string> = {
  chili: "Chili",
  lemon: "Lemon",
  avocado: "Avocado",
};
