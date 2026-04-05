import { describe, expect, it } from "vitest";
import { GAME_PHASE, type GameState } from "@sweet-spicy/shared-types";
import { toClientGameState } from "./client-state.js";

function createState(phase: GameState["phase"]): GameState {
  return {
    phase,
    players: [
      {
        id: "self",
        nickname: "Self",
        hand: [{ id: "self-card", kind: "normal", type: "chili", number: 2 }],
        wonPile: [],
        trophyCount: 0,
        isReady: true,
      },
      {
        id: "opponent",
        nickname: "Opponent",
        hand: [{ id: "opp-card", kind: "normal", type: "lemon", number: 8 }],
        wonPile: [{ id: "won-card", kind: "normal", type: "avocado", number: 6 }],
        trophyCount: 0,
        isReady: true,
      },
    ],
    currentPlayerIndex: 0,
    drawPile: [{ id: "draw-card", kind: "normal", type: "avocado", number: 1 }],
    tablePile: [{ id: "table-card", kind: "normal", type: "chili", number: 3 }],
    lockedSuit: "chili",
    supremeReserve: 0,
    trophiesRemaining: 2,
    playedCard: {
      playerId: "opponent",
      declaration: { type: "chili", number: 8 },
      card: { id: "hidden", kind: "normal", type: "lemon", number: 8 },
    },
    challengeResult: null,
    challengeTimer: 4,
    challengeStep: phase === GAME_PHASE.CHALLENGE_PHASE ? "CLAIM_RACE" : null,
    challengeClaimHolderId: null,
    challengePassIds: [],
    lastResolvedDeclaration: null,
    winner: null,
    winners: [],
    roomCode: "ABCD",
  };
}

describe("toClientGameState", () => {
  it("masks opponent hands and hidden played card during challenge phase", () => {
    const clientState = toClientGameState(createState(GAME_PHASE.CHALLENGE_PHASE), "self");

    expect(clientState.players[0]?.hand).toHaveLength(1);
    expect(clientState.players[1]?.hand).toHaveLength(0);
    expect(clientState.players[1]?.handCount).toBe(1);
    expect(clientState.playedCard?.card).toBeNull();
    expect(clientState.tablePileCount).toBe(1);
    expect(clientState.drawPileCount).toBe(1);
  });

  it("reveals the played card after challenge resolution while still masking opponent hands", () => {
    const clientState = toClientGameState(createState(GAME_PHASE.REVEAL), "self");

    expect(clientState.playedCard?.card).toMatchObject({ id: "hidden", type: "lemon", number: 8 });
    expect(clientState.players[1]?.hand).toHaveLength(0);
    expect(clientState.players[1]?.wonPileCount).toBe(1);
  });

  it("exposes the played Total Wild to all viewers during SUPREME_RESOLVE", () => {
    const gs = createState(GAME_PHASE.SUPREME_RESOLVE);
    const tw = { id: "tw", kind: "total-wild" as const, type: "chili" as const, number: 1 };
    gs.playedCard = {
      playerId: "opponent",
      declaration: { type: "avocado", number: 10 },
      card: tw,
    };
    const clientState = toClientGameState(gs, "self");

    expect(clientState.playedCard?.card).toMatchObject({ id: "tw", kind: "total-wild" });
  });
});
