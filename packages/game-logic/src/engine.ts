import type {
  ChallengeResult,
  ChallengeType,
  Declaration,
  GameCard,
  GamePlayer,
  GameState,
  SpiceType,
} from "@sweet-spicy/shared-types";
import { isWildCardKind } from "@sweet-spicy/shared-types";
import {
  CHALLENGE_CLAIM_RACE_SECONDS,
  CHALLENGE_PICK_TYPE_SECONDS,
  DRAW_PASS_TURN_CARD_COUNT,
  IDLE_CHALLENGE_TIMER_SECONDS,
  INITIAL_HAND_SIZE,
  NORMAL_CARD_POINTS,
  OPENING_RANK_MAX,
  PENALTY_DRAW_COUNT,
  PHASE_STEP_PAUSE_SECONDS,
  REFILL_HAND_SIZE,
  TOTAL_TROPHIES,
  TOTAL_WILD_CARDS,
  TROPHY_CARD_POINTS,
  WILD_CARD_PENALTY,
  WILD_CARD_POINTS,
  WILD_NUMBER_CARDS,
  WILD_SUIT_CARDS,
} from "./game-timing.js";

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Highest rank on a Spicy card. */
export const MAX_DECLARATION_RANK = 10 as const;

/**
 * After a resolved play at rank 10, the chain resets: the next declaration rank must be 1..RANK_RESET_MAX_INCLUSIVE only.
 */
export const RANK_RESET_MAX_INCLUSIVE = 3 as const;

const SPICES: SpiceType[] = ["chili", "lemon", "avocado"];

export function createTrophyCard(): GameCard {
  return {
    id: generateId(),
    kind: "trophy",
    type: "chili",
    number: 0,
  };
}

function createTotalWildCard(): GameCard {
  return {
    id: generateId(),
    kind: "total-wild",
    type: "chili",
    number: 1,
  };
}

/**
 * Main deck: 30 normal + wild suit + wild number (no Total Wild, no trophies).
 */
export function createDeck(): GameCard[] {
  const cards: GameCard[] = [];
  for (const type of SPICES) {
    for (let num = 1; num <= MAX_DECLARATION_RANK; num++) {
      cards.push({ id: generateId(), kind: "normal", type, number: num });
    }
  }
  for (let i = 0; i < WILD_SUIT_CARDS; i++) {
    const num = (i % MAX_DECLARATION_RANK) + 1;
    const type = SPICES[i % SPICES.length]!;
    cards.push({ id: generateId(), kind: "wild-suit", type, number: num });
  }
  for (let i = 0; i < WILD_NUMBER_CARDS; i++) {
    const type = SPICES[i % SPICES.length]!;
    cards.push({ id: generateId(), kind: "wild-number", type, number: 1 });
  }
  return shuffleArray(cards);
}

function createTotalWildPool(): GameCard[] {
  const pool: GameCard[] = [];
  for (let i = 0; i < TOTAL_WILD_CARDS; i++) {
    pool.push(createTotalWildCard());
  }
  return pool;
}

/** Draw up to `count` from draw pile only (no discard recycling). */
function drawFromDrawPile(
  drawPile: GameCard[],
  count: number,
): { drawPile: GameCard[]; drawn: GameCard[] } {
  const draw = [...drawPile];
  const drawn: GameCard[] = [];
  while (drawn.length < count && draw.length > 0) {
    drawn.push(draw.shift()!);
  }
  return { drawPile: draw, drawn };
}

/** Whether the physical card matches the declared suit (for challenge resolution). */
export function cardPassesSuitCheck(card: GameCard, declaration: Declaration): boolean {
  if (card.kind === "wild-suit" || card.kind === "total-wild") return true;
  return card.type === declaration.type;
}

/** Whether the physical card matches the declared number (for challenge resolution). */
export function cardPassesNumberCheck(card: GameCard, declaration: Declaration): boolean {
  if (card.kind === "wild-number" || card.kind === "total-wild") return true;
  return card.number === declaration.number;
}

function cardPassesChallengeAttribute(
  card: GameCard,
  declaration: Declaration,
  challengeType: ChallengeType,
): boolean {
  return challengeType === "suit"
    ? cardPassesSuitCheck(card, declaration)
    : cardPassesNumberCheck(card, declaration);
}

/**
 * `true` when the real card does **not** match the declaration on the challenged attribute
 * (the declarer was bluffing on that attribute) — the **challenger wins** the table pile in
 * {@link applyPenalty}. `false` means the card matches; the declarer wins the pile and the
 * challenger draws the penalty.
 */
export function isChallengeCorrect(
  card: GameCard,
  declaration: Declaration,
  challengeType: ChallengeType,
): boolean {
  return !cardPassesChallengeAttribute(card, declaration, challengeType);
}

export function scoreWonPileCards(cards: GameCard[]): number {
  let s = 0;
  for (const c of cards) {
    if (c.kind === "trophy") s += TROPHY_CARD_POINTS;
    else if (isWildCardKind(c.kind)) s += WILD_CARD_POINTS;
    else s += NORMAL_CARD_POINTS;
  }
  return s;
}

export function wildCardsInHandPenalty(hand: GameCard[]): number {
  let p = 0;
  for (const c of hand) {
    if (isWildCardKind(c.kind)) p += WILD_CARD_PENALTY;
  }
  return p;
}

export function computePlayerFinalScore(player: GamePlayer): number {
  return scoreWonPileCards(player.wonPile) - wildCardsInHandPenalty(player.hand);
}

/** Detailed breakdown for end-game / scoreboard UI (full `GamePlayer` only). */
export interface PlayerScoreBreakdown {
  normalCardsInPile: number;
  wildCardsInPile: number;
  trophiesInPile: number;
  pilePoints: number;
  wildCardsInHand: number;
  wildPenalty: number;
  total: number;
}

export function getPlayerScoreBreakdown(player: GamePlayer): PlayerScoreBreakdown {
  let normalCardsInPile = 0;
  let wildCardsInPile = 0;
  let trophiesInPile = 0;
  for (const c of player.wonPile) {
    if (c.kind === "trophy") trophiesInPile++;
    else if (isWildCardKind(c.kind)) wildCardsInPile++;
    else normalCardsInPile++;
  }
  const pilePoints = scoreWonPileCards(player.wonPile);
  const wildPenalty = wildCardsInHandPenalty(player.hand);
  let wildCardsInHand = 0;
  for (const c of player.hand) {
    if (isWildCardKind(c.kind)) wildCardsInHand++;
  }
  return {
    normalCardsInPile,
    wildCardsInPile,
    trophiesInPile,
    pilePoints,
    wildCardsInHand,
    wildPenalty,
    total: pilePoints - wildPenalty,
  };
}

/**
 * Minimum rank for the next declaration (UI / bots).
 */
export function minDeclarationRankAfterResolve(last: Declaration | null): number {
  if (last == null) return 1;
  const n = Math.floor(Number(last.number));
  if (!Number.isFinite(n)) return 1;
  if (n >= MAX_DECLARATION_RANK) return 1;
  return n + 1;
}

/**
 * Maximum rank allowed for the next declaration (UI / bots).
 */
export function maxDeclarationRankAfterResolve(last: Declaration | null): number {
  if (last == null) return MAX_DECLARATION_RANK;
  const n = Math.floor(Number(last.number));
  if (!Number.isFinite(n)) return MAX_DECLARATION_RANK;
  if (n >= MAX_DECLARATION_RANK) return RANK_RESET_MAX_INCLUSIVE;
  return MAX_DECLARATION_RANK;
}

/** Subset of game state needed for declaration rank bounds (works with {@link ClientGameState}). */
export type DeclarationFlowState = Pick<GameState, "lockedSuit" | "lastResolvedDeclaration">;

/** UI: first card of a new round uses ranks 1..OPENING_RANK_MAX; then locked-suit escalation. */
export function minDeclarationRankForState(state: DeclarationFlowState): number {
  if (state.lockedSuit == null) return 1;
  return minDeclarationRankAfterResolve(state.lastResolvedDeclaration);
}

export function maxDeclarationRankForState(state: DeclarationFlowState): number {
  if (state.lockedSuit == null) return OPENING_RANK_MAX;
  return maxDeclarationRankAfterResolve(state.lastResolvedDeclaration);
}

function isDeclarationValidForRound(state: GameState, declaration: Declaration): boolean {
  const declNum = Math.floor(Number(declaration.number));
  if (!Number.isFinite(declNum)) return false;
  if (declNum < 1 || declNum > MAX_DECLARATION_RANK) return false;

  if (state.lockedSuit == null) {
    return declNum >= 1 && declNum <= OPENING_RANK_MAX;
  }

  if (declaration.type !== state.lockedSuit) return false;

  if (state.lastResolvedDeclaration == null) {
    return true;
  }

  const lastNum = Math.floor(Number(state.lastResolvedDeclaration.number));
  if (!Number.isFinite(lastNum)) return true;
  if (lastNum >= MAX_DECLARATION_RANK) {
    return declNum >= 1 && declNum <= RANK_RESET_MAX_INCLUSIVE;
  }
  return declNum > lastNum;
}

export function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function createPlayer(id: string, nickname: string): GamePlayer {
  return {
    id,
    nickname,
    hand: [],
    wonPile: [],
    trophyCount: 0,
    isReady: false,
  };
}

export function createLobbyPlayer(nickname: string): GamePlayer {
  return createPlayer(generateId(), nickname);
}

export function createInitialState(roomCode: string): GameState {
  return {
    phase: "LOBBY",
    players: [],
    currentPlayerIndex: 0,
    drawPile: [],
    tablePile: [],
    lockedSuit: null,
    supremeReserve: 0,
    trophiesRemaining: TOTAL_TROPHIES,
    playedCard: null,
    challengeResult: null,
    challengeTimer: IDLE_CHALLENGE_TIMER_SECONDS,
    challengeStep: null,
    challengeClaimHolderId: null,
    lastResolvedDeclaration: null,
    winner: null,
    winners: [],
    roomCode,
  };
}

export function addPlayerToGame(state: GameState, player: GamePlayer): GameState {
  return {
    ...state,
    players: [...state.players, player],
  };
}

export function removePlayerFromGame(state: GameState, playerId: string): GameState {
  const newPlayers = state.players.filter((p) => p.id !== playerId);
  let newCurrentIndex = state.currentPlayerIndex;
  if (newCurrentIndex >= newPlayers.length) {
    newCurrentIndex = Math.max(0, newPlayers.length - 1);
  }
  return {
    ...state,
    players: newPlayers,
    currentPlayerIndex: newCurrentIndex,
  };
}

export function startGame(state: GameState): GameState {
  let deck = createDeck();
  const wildStack = shuffleArray(createTotalWildPool());
  const n = state.players.length;

  const players: GamePlayer[] = state.players.map((p) => ({
    ...p,
    hand: [],
    wonPile: [],
    trophyCount: 0,
  }));

  for (let i = 0; i < n; i++) {
    const dealt = drawFromDrawPile(deck, INITIAL_HAND_SIZE);
    deck = dealt.drawPile;
    const tw = wildStack.pop();
    if (!tw) break;
    const prevPlayer = players[i];
    if (!prevPlayer) break;
    players[i] = {
      ...prevPlayer,
      hand: [...dealt.drawn, tw],
    };
  }

  const supremeReserve = wildStack.length;

  const firstPlayer = Math.floor(Math.random() * players.length);

  return {
    ...state,
    phase: "PLAYER_TURN",
    players,
    drawPile: deck,
    tablePile: [],
    lockedSuit: null,
    supremeReserve,
    trophiesRemaining: TOTAL_TROPHIES,
    currentPlayerIndex: firstPlayer,
    playedCard: null,
    challengeResult: null,
    winner: null,
    winners: [],
    lastResolvedDeclaration: null,
    challengeTimer: 0,
    challengeStep: null,
    challengeClaimHolderId: null,
  };
}

/** Authoritative play (server): validates current player */
export function playCard(
  state: GameState,
  playerId: string,
  cardId: string,
  declaration: Declaration,
): GameState | null {
  const currentPlayer = state.players[state.currentPlayerIndex];
  if (!currentPlayer || currentPlayer.id !== playerId) {
    return null;
  }
  if (state.phase !== "PLAYER_TURN") return null;
  if (!isDeclarationValidForRound(state, declaration)) {
    return null;
  }
  const cardIndex = currentPlayer.hand.findIndex((c) => c.id === cardId);
  if (cardIndex === -1) return null;

  const card = currentPlayer.hand[cardIndex];
  const newHand = currentPlayer.hand.filter((_, i) => i !== cardIndex);

  const updatedPlayers = state.players.map((p, i) =>
    i === state.currentPlayerIndex ? { ...p, hand: newHand } : p,
  );

  const lockedSuit = state.lockedSuit ?? declaration.type;

  return {
    ...state,
    phase: "CHALLENGE_PHASE",
    players: updatedPlayers,
    lockedSuit,
    playedCard: {
      card,
      declaration,
      playerId: currentPlayer.id,
    },
    challengeTimer: CHALLENGE_CLAIM_RACE_SECONDS,
    challengeStep: "CLAIM_RACE",
    challengeClaimHolderId: null,
  };
}

/** Declaration alternative: draw one from the main pile and advance turn (no challenge phase). */
export function drawAndPassTurn(state: GameState, playerId: string): GameState | null {
  const currentPlayer = state.players[state.currentPlayerIndex];
  if (!currentPlayer || currentPlayer.id !== playerId) {
    return null;
  }
  if (state.phase !== "PLAYER_TURN") return null;
  if (state.drawPile.length < DRAW_PASS_TURN_CARD_COUNT) return null;

  let drawPile = [...state.drawPile];
  const { drawPile: nextPile, drawn } = drawFromDrawPile(drawPile, DRAW_PASS_TURN_CARD_COUNT);
  drawPile = nextPile;

  const updatedPlayers = state.players.map((p, i) =>
    i === state.currentPlayerIndex ? { ...p, hand: [...p.hand, ...drawn] } : p,
  );
  const nextIndex = (state.currentPlayerIndex + 1) % state.players.length;

  const nextState: GameState = {
    ...state,
    players: updatedPlayers,
    drawPile,
    currentPlayerIndex: nextIndex,
  };

  if (shouldEndGame(nextState)) {
    return endGame(nextState);
  }
  return nextState;
}

export function drawAndPassTurnLocal(state: GameState, playerId: string): GameState {
  return drawAndPassTurn(state, playerId) ?? state;
}

export function playCardLocal(
  state: GameState,
  cardId: string,
  declaration: Declaration,
): GameState {
  const currentPlayer = state.players[state.currentPlayerIndex];
  const cardIndex = currentPlayer.hand.findIndex((c) => c.id === cardId);
  if (cardIndex === -1) return state;
  if (state.phase !== "PLAYER_TURN") return state;
  if (!isDeclarationValidForRound(state, declaration)) {
    return state;
  }

  const card = currentPlayer.hand[cardIndex];
  const newHand = currentPlayer.hand.filter((_, i) => i !== cardIndex);

  const updatedPlayers = state.players.map((p, i) =>
    i === state.currentPlayerIndex ? { ...p, hand: newHand } : p,
  );

  const lockedSuit = state.lockedSuit ?? declaration.type;

  return {
    ...state,
    phase: "CHALLENGE_PHASE",
    players: updatedPlayers,
    lockedSuit,
    playedCard: {
      card,
      declaration,
      playerId: currentPlayer.id,
    },
    challengeTimer: CHALLENGE_CLAIM_RACE_SECONDS,
    challengeStep: "CLAIM_RACE",
    challengeClaimHolderId: null,
  };
}

/**
 * First eligible non-declarer claim wins (server should reject duplicates).
 * Advances to pick-type step with a fresh timer.
 */
export function claimChallenge(state: GameState, playerId: string): GameState | null {
  if (state.phase !== "CHALLENGE_PHASE") return null;
  if (state.challengeStep !== "CLAIM_RACE") return null;
  if (state.challengeClaimHolderId != null) return null;
  const played = state.playedCard;
  if (!played) return null;
  if (played.playerId === playerId) return null;
  if (!state.players.some((p) => p.id === playerId)) return null;

  return {
    ...state,
    challengeClaimHolderId: playerId,
    challengeStep: "PICK_TYPE",
    challengeTimer: CHALLENGE_PICK_TYPE_SECONDS,
  };
}

export function resolveChallenge(
  state: GameState,
  challengerId: string,
  challengeType: ChallengeType,
): GameState {
  if (!state.playedCard) return state;
  if (state.phase !== "CHALLENGE_PHASE") return state;
  if (state.challengeStep !== "PICK_TYPE" || state.challengeClaimHolderId !== challengerId) {
    return state;
  }

  const { card, declaration, playerId } = state.playedCard;
  const challengeCorrect = isChallengeCorrect(card, declaration, challengeType);

  const result: ChallengeResult = {
    challengeCorrect,
    challengeType,
    challengerId,
    playerId,
    realCard: card,
    declaredCard: declaration,
  };

  return {
    ...state,
    phase: "REVEAL",
    challengeResult: result,
    challengeTimer: PHASE_STEP_PAUSE_SECONDS,
    challengeStep: null,
    challengeClaimHolderId: null,
  };
}

/** Pick timer expired: challenger is treated as wrong (declarer takes pile; challenger draws). */
export function resolveChallengeTimeout(state: GameState): GameState {
  if (!state.playedCard) return state;
  const holder = state.challengeClaimHolderId;
  if (!holder) return acceptDeclaration(state);

  const { card, declaration, playerId } = state.playedCard;
  const challengeType: ChallengeType = "suit";
  const result: ChallengeResult = {
    challengeCorrect: false,
    challengeType,
    challengerId: holder,
    playerId,
    realCard: card,
    declaredCard: declaration,
    timedOut: true,
  };

  return {
    ...state,
    phase: "REVEAL",
    challengeResult: result,
    challengeTimer: PHASE_STEP_PAUSE_SECONDS,
    challengeStep: null,
    challengeClaimHolderId: null,
  };
}

/** Server + offline: decrement challenge timer once; auto-accept or timeout pick when it hits 0. */
export function tickChallengePhase(state: GameState): GameState {
  if (state.phase !== "CHALLENGE_PHASE") return state;
  const nextTimer = Math.max(0, state.challengeTimer - 1);
  if (nextTimer > 0) {
    return { ...state, challengeTimer: nextTimer };
  }
  if (state.challengeStep === "CLAIM_RACE") {
    return acceptDeclaration(state);
  }
  if (state.challengeStep === "PICK_TYPE" && state.challengeClaimHolderId != null) {
    return resolveChallengeTimeout(state);
  }
  return acceptDeclaration(state);
}

export function applyPenalty(state: GameState): GameState {
  if (!state.challengeResult || !state.playedCard) return state;

  const { challengeCorrect, challengerId, playerId } = state.challengeResult;
  const played = state.playedCard;
  const tableCards = [...state.tablePile, played.card];

  let drawPile = [...state.drawPile];
  let supremeReserve = state.supremeReserve;
  let players = state.players.map((p) => ({ ...p }));

  const winnerPileId = challengeCorrect ? challengerId : playerId;
  const loserId = challengeCorrect ? playerId : challengerId;

  const winIdx = players.findIndex((p) => p.id === winnerPileId);
  if (winIdx !== -1) {
    players[winIdx] = {
      ...players[winIdx],
      wonPile: [...players[winIdx].wonPile, ...tableCards],
    };
  }

  if (!challengeCorrect) {
    const chIdx = players.findIndex((p) => p.id === challengerId);
    if (chIdx !== -1) {
      const drawn = drawFromDrawPile(drawPile, PENALTY_DRAW_COUNT);
      drawPile = drawn.drawPile;
      let hand = [...players[chIdx].hand, ...drawn.drawn];
      const hasTotalWild = hand.some((c) => c.kind === "total-wild");
      if (!hasTotalWild && supremeReserve > 0) {
        const tw = createTotalWildCard();
        supremeReserve -= 1;
        hand = [...hand, tw];
      }
      players[chIdx] = { ...players[chIdx], hand };
    }
  }

  const loserIdx = players.findIndex((p) => p.id === loserId);

  return {
    ...state,
    phase: "PENALTY",
    players,
    drawPile,
    supremeReserve,
    tablePile: [],
    playedCard: null,
    challengeResult: null,
    lockedSuit: null,
    lastResolvedDeclaration: null,
    challengeTimer: PHASE_STEP_PAUSE_SECONDS,
    currentPlayerIndex: loserIdx >= 0 ? loserIdx : state.currentPlayerIndex,
    challengeStep: null,
    challengeClaimHolderId: null,
  };
}

function shouldEndGame(state: GameState): boolean {
  if (state.trophiesRemaining <= 0) return true;
  if (state.drawPile.length === 0) return true;
  return false;
}

function endGame(state: GameState): GameState {
  const scores = state.players.map((p) => computePlayerFinalScore(p));
  const maxScore = Math.max(...scores, 0);
  const winnersList = state.players.filter((_, i) => scores[i] === maxScore);

  return {
    ...state,
    phase: "END_GAME",
    playedCard: null,
    drawPile: [],
    winner: winnersList.length === 1 ? winnersList[0]! : null,
    winners: winnersList,
    challengeTimer: 0,
    challengeStep: null,
    challengeClaimHolderId: null,
  };
}

export function acceptDeclaration(state: GameState): GameState {
  const played = state.playedCard;
  if (!played) {
    return state;
  }

  let tablePile = [...state.tablePile, played.card];
  let players = state.players.map((p) => ({ ...p }));
  let drawPile = [...state.drawPile];
  let trophiesRemaining = state.trophiesRemaining;
  let phase: GameState["phase"] = "NEXT_TURN";
  const declarerIdx = players.findIndex((p) => p.id === played.playerId);
  if (declarerIdx === -1) return state;

  const handEmpty = players[declarerIdx]!.hand.length === 0;
  const lastIsTotalWild = played.card.kind === "total-wild";

  if (handEmpty) {
    if (!lastIsTotalWild && trophiesRemaining > 0) {
      trophiesRemaining -= 1;
      const trophyCard = createTrophyCard();
      players[declarerIdx] = {
        ...players[declarerIdx]!,
        wonPile: [...players[declarerIdx]!.wonPile, trophyCard],
        trophyCount: players[declarerIdx]!.trophyCount + 1,
      };
      const refill = drawFromDrawPile(drawPile, REFILL_HAND_SIZE);
      drawPile = refill.drawPile;
      players[declarerIdx] = {
        ...players[declarerIdx]!,
        hand: [...players[declarerIdx]!.hand, ...refill.drawn],
      };
      phase = "TROPHY_AWARDED";
    } else {
      const refill = drawFromDrawPile(drawPile, REFILL_HAND_SIZE);
      drawPile = refill.drawPile;
      players[declarerIdx] = {
        ...players[declarerIdx]!,
        hand: [...players[declarerIdx]!.hand, ...refill.drawn],
      };
    }
  }

  const nextIndex = (declarerIdx + 1) % players.length;

  const nextState: GameState = {
    ...state,
    players,
    drawPile,
    tablePile,
    trophiesRemaining,
    phase,
    playedCard: null,
    challengeResult: null,
    lastResolvedDeclaration: played.declaration,
    challengeTimer: PHASE_STEP_PAUSE_SECONDS,
    currentPlayerIndex: nextIndex,
    challengeStep: null,
    challengeClaimHolderId: null,
  };

  if (shouldEndGame(nextState)) {
    return endGame(nextState);
  }

  return nextState;
}

export function nextTurn(state: GameState): GameState {
  if (state.phase === "PENALTY") {
    const after = { ...state, phase: "PLAYER_TURN" as const, challengeTimer: 0 };
    if (shouldEndGame(after)) return endGame(after);
    return after;
  }

  if (state.phase === "TROPHY_AWARDED") {
    const after = { ...state, phase: "PLAYER_TURN" as const, challengeTimer: 0 };
    if (shouldEndGame(after)) return endGame(after);
    return after;
  }

  if (state.phase === "NEXT_TURN") {
    const after = { ...state, phase: "PLAYER_TURN" as const, challengeTimer: 0 };
    if (shouldEndGame(after)) return endGame(after);
    return after;
  }

  return state;
}
