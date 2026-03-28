export type {
  GameCard,
  GamePlayer,
  GameState,
  ClientGameState,
  ClientGamePlayer,
  ClientPlayedCard,
  GamePhase,
  ChallengeStep,
  Declaration,
  ChallengeResult,
  ChallengeType,
  CardKind,
  PlayedCard,
  SpiceType,
} from "@sweet-spicy/shared-types";
export type Player = import("@sweet-spicy/shared-types").GamePlayer | import("@sweet-spicy/shared-types").ClientGamePlayer;
export type GameViewState = import("@sweet-spicy/shared-types").GameState | import("@sweet-spicy/shared-types").ClientGameState;
export {
  GAME_PHASE,
  SPICE_EMOJI,
  SPICE_LABEL,
  getPlayerHandCount,
  isClientGameState,
  getDrawPileCount,
  isWildCardKind,
} from "@sweet-spicy/shared-types";
