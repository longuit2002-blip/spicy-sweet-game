import { describe, expect, it } from "vitest";
import type { Declaration, GameCard, GameState } from "@sweet-spicy/shared-types";
import { GAME_PHASE } from "@sweet-spicy/shared-types";
import {
  acceptDeclaration,
  applyPenalty,
  computePlayerFinalScore,
  tickChallengePhase,
} from "./engine.js";

function createCard(id: string, type: GameCard["type"], number: number, kind: GameCard["kind"] = "normal"): GameCard {
  return { id, type, number, kind };
}

function createBaseState(partial?: Partial<GameState>): GameState {
  return {
    phase: GAME_PHASE.PLAYER_TURN,
    players: [
      {
        id: "p1",
        nickname: "Alpha",
        hand: [createCard("p1-hand", "chili", 3)],
        wonPile: [],
        trophyCount: 0,
        isReady: true,
        isHost: true,
      },
      {
        id: "p2",
        nickname: "Beta",
        hand: [createCard("p2-hand", "lemon", 4)],
        wonPile: [],
        trophyCount: 0,
        isReady: true,
      },
    ],
    currentPlayerIndex: 0,
    drawPile: [createCard("draw-1", "avocado", 5), createCard("draw-2", "chili", 6), createCard("draw-3", "lemon", 7)],
    tablePile: [],
    lockedSuit: null,
    supremeReserve: 0,
    trophiesRemaining: 3,
    playedCard: null,
    challengeResult: null,
    challengeTimer: 0,
    challengeStep: null,
    challengeClaimHolderId: null,
    challengePassIds: [],
    lastResolvedDeclaration: null,
    winner: null,
    winners: [],
    roomCode: "ABCD",
    ...partial,
  };
}

describe("engine challenge and scoring flows", () => {
  it("times out a PICK_TYPE challenge into reveal with a timedOut result", () => {
    const declaration: Declaration = { type: "chili", number: 5 };
    const state = createBaseState({
      phase: GAME_PHASE.CHALLENGE_PHASE,
      challengeTimer: 1,
      challengeStep: "PICK_TYPE",
      challengeClaimHolderId: "p2",
      playedCard: {
        playerId: "p1",
        declaration,
        card: createCard("played", "chili", 5),
      },
    });

    const nextState = tickChallengePhase(state);

    expect(nextState.phase).toBe(GAME_PHASE.REVEAL);
    expect(nextState.challengeResult).toMatchObject({
      timedOut: true,
      challengerId: "p2",
      playerId: "p1",
      challengeCorrect: false,
    });
  });

  it("applies a correct challenge by giving the pile to the challenger and drawing penalty cards for declarer", () => {
    const declaration: Declaration = { type: "chili", number: 8 };
    const state = createBaseState({
      phase: GAME_PHASE.REVEAL,
      playedCard: {
        playerId: "p1",
        declaration,
        card: createCard("played", "lemon", 2),
      },
      tablePile: [createCard("table-1", "avocado", 1)],
      challengeResult: {
        challengeCorrect: true,
        challengeType: "suit",
        challengerId: "p2",
        playerId: "p1",
        realCard: createCard("played", "lemon", 2),
        declaredCard: declaration,
      },
    });

    const nextState = applyPenalty(state);

    expect(nextState.phase).toBe(GAME_PHASE.PENALTY);
    expect(nextState.players[1]?.wonPile).toHaveLength(2);
    expect(nextState.players[0]?.hand).toHaveLength(3);
  });

  it("accepts a declaration on an empty hand by awarding a trophy and refilling cards", () => {
    const declaration: Declaration = { type: "chili", number: 3 };
    const state = createBaseState({
      phase: GAME_PHASE.CHALLENGE_PHASE,
      drawPile: [
        createCard("draw-a", "avocado", 1),
        createCard("draw-b", "avocado", 2),
        createCard("draw-c", "avocado", 3),
        createCard("draw-d", "avocado", 4),
        createCard("draw-e", "avocado", 5),
        createCard("draw-f", "avocado", 6),
      ],
      players: [
        {
          id: "p1",
          nickname: "Alpha",
          hand: [],
          wonPile: [],
          trophyCount: 0,
          isReady: true,
          isHost: true,
        },
        {
          id: "p2",
          nickname: "Beta",
          hand: [createCard("p2-hand", "lemon", 4)],
          wonPile: [],
          trophyCount: 0,
          isReady: true,
        },
      ],
      playedCard: {
        playerId: "p1",
        declaration,
        card: createCard("played", "chili", 3),
      },
    });

    const nextState = acceptDeclaration(state);

    expect(nextState.phase).toBe(GAME_PHASE.TROPHY_AWARDED);
    expect(nextState.players[0]?.trophyCount).toBe(1);
    expect(nextState.players[0]?.hand).toHaveLength(5);
    expect(nextState.trophiesRemaining).toBe(2);
  });

  it("computes end-game winners using won pile points minus wild-card hand penalty", () => {
    const alphaScore = computePlayerFinalScore({
      id: "p1",
      nickname: "Alpha",
      hand: [createCard("wild", "chili", 1, "wild-number")],
      wonPile: [createCard("trophy", "chili", 0, "trophy"), createCard("normal", "chili", 7)],
      trophyCount: 1,
      isReady: true,
    });

    const betaScore = computePlayerFinalScore({
      id: "p2",
      nickname: "Beta",
      hand: [],
      wonPile: [createCard("normal-1", "lemon", 3), createCard("normal-2", "lemon", 4)],
      trophyCount: 0,
      isReady: true,
    });

    expect(alphaScore).toBeGreaterThan(betaScore);
  });
});
