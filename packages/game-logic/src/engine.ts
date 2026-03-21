import type {
  ChallengeResult,
  Declaration,
  GameCard,
  GamePlayer,
  GameState,
} from "@sweet-spicy/shared-types";

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

export function createDeck(): GameCard[] {
  const types: Array<"chili" | "pepper" | "lemon"> = ["chili", "pepper", "lemon"];
  const cards: GameCard[] = [];
  for (const type of types) {
    for (let num = 1; num <= 10; num++) {
      cards.push({ id: generateId(), type, number: num });
    }
  }
  return shuffleArray(cards);
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
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
    score: 0,
    successfulBluffs: 0,
    successfulChallenges: 0,
    isReady: false,
  };
}

/** Client lobby / bots: generates id */
export function createLobbyPlayer(nickname: string): GamePlayer {
  return createPlayer(generateId(), nickname);
}

export function createInitialState(roomCode: string): GameState {
  return {
    phase: "LOBBY",
    players: [],
    currentPlayerIndex: 0,
    drawPile: [],
    playedCard: null,
    challengeResult: null,
    challengeTimer: 5,
    winner: null,
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
  const deck = createDeck();
  const players = state.players.map((p) => ({ ...p }));
  const cardsPerPlayer = 5;

  for (let i = 0; i < players.length; i++) {
    players[i] = {
      ...players[i],
      hand: deck.splice(0, cardsPerPlayer),
      score: 0,
      successfulBluffs: 0,
      successfulChallenges: 0,
    };
  }

  const firstPlayer = Math.floor(Math.random() * players.length);

  return {
    ...state,
    phase: "PLAYER_TURN",
    players,
    drawPile: deck,
    currentPlayerIndex: firstPlayer,
    playedCard: null,
    challengeResult: null,
    winner: null,
    challengeTimer: 0,
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
  const cardIndex = currentPlayer.hand.findIndex((c) => c.id === cardId);
  if (cardIndex === -1) return null;

  const card = currentPlayer.hand[cardIndex];
  const newHand = currentPlayer.hand.filter((_, i) => i !== cardIndex);

  const updatedPlayers = state.players.map((p, i) =>
    i === state.currentPlayerIndex ? { ...p, hand: newHand } : p,
  );

  return {
    ...state,
    phase: "CHALLENGE_PHASE",
    players: updatedPlayers,
    playedCard: {
      card,
      declaration,
      playerId: currentPlayer.id,
    },
    challengeTimer: 5,
  };
}

/** Client-side / offline: no playerId check (uses current index) */
export function playCardLocal(
  state: GameState,
  cardId: string,
  declaration: Declaration,
): GameState {
  const currentPlayer = state.players[state.currentPlayerIndex];
  const cardIndex = currentPlayer.hand.findIndex((c) => c.id === cardId);
  if (cardIndex === -1) return state;

  const card = currentPlayer.hand[cardIndex];
  const newHand = currentPlayer.hand.filter((_, i) => i !== cardIndex);

  const updatedPlayers = state.players.map((p, i) =>
    i === state.currentPlayerIndex ? { ...p, hand: newHand } : p,
  );

  return {
    ...state,
    phase: "CHALLENGE_PHASE",
    players: updatedPlayers,
    playedCard: {
      card,
      declaration,
      playerId: currentPlayer.id,
    },
    challengeTimer: 5,
  };
}

export function resolveChallenge(state: GameState, challengerId: string): GameState {
  if (!state.playedCard) return state;

  const { card, declaration, playerId } = state.playedCard;
  const wasBluff = card.type !== declaration.type || card.number !== declaration.number;

  const result: ChallengeResult = {
    wasBluff,
    challengerId,
    playerId,
    realCard: card,
    declaredCard: declaration,
  };

  return {
    ...state,
    phase: "REVEAL",
    challengeResult: result,
    challengeTimer: 2,
  };
}

export function applyPenalty(state: GameState): GameState {
  if (!state.challengeResult) return state;

  const { wasBluff, challengerId, playerId } = state.challengeResult;
  const penaltyPlayerId = wasBluff ? playerId : challengerId;

  let drawPile = [...state.drawPile];
  const penaltyCards = drawPile.splice(0, 2);

  const players = state.players.map((p) => {
    if (p.id === penaltyPlayerId) {
      return { ...p, hand: [...p.hand, ...penaltyCards] };
    }
    if (wasBluff && p.id === challengerId) {
      return { ...p, score: p.score + 1, successfulChallenges: p.successfulChallenges + 1 };
    }
    return p;
  });

  return {
    ...state,
    phase: "PENALTY",
    players,
    drawPile,
    challengeTimer: 2,
  };
}

export function acceptDeclaration(state: GameState): GameState {
  const players = state.players.map((p) => {
    if (p.id === state.playedCard?.playerId) {
      return { ...p, score: p.score + 1, successfulBluffs: p.successfulBluffs + 1 };
    }
    return p;
  });

  return {
    ...state,
    players,
    phase: "NEXT_TURN",
    playedCard: null,
    challengeResult: null,
    challengeTimer: 2,
  };
}

export function nextTurn(state: GameState): GameState {
  const emptyHandPlayer = state.players.find((p) => p.hand.length === 0);
  if (emptyHandPlayer || state.drawPile.length === 0) {
    return endGame(state, emptyHandPlayer ?? null);
  }

  const nextIndex = (state.currentPlayerIndex + 1) % state.players.length;

  return {
    ...state,
    phase: "PLAYER_TURN",
    currentPlayerIndex: nextIndex,
    playedCard: null,
    challengeResult: null,
    challengeTimer: 0,
  };
}

function endGame(state: GameState, emptyHandPlayer: GamePlayer | null): GameState {
  const players = state.players.map((p) => {
    let finalScore = p.score;
    if (emptyHandPlayer && p.id === emptyHandPlayer.id) {
      finalScore += 3;
    }
    finalScore -= p.hand.length;
    return { ...p, score: finalScore };
  });

  const winner = players.reduce((best, p) => (p.score > best.score ? p : best), players[0]);

  return {
    ...state,
    phase: "END_GAME",
    players,
    winner,
    challengeTimer: 0,
  };
}
