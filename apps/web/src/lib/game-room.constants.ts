import {
  CHALLENGE_PHASE_COUNTDOWN_SECONDS,
  PHASE_STEP_PAUSE_SECONDS,
} from "@sweet-spicy/game-logic";
import {
  DEFAULT_ROOM_MAX_PLAYERS,
  GAME_PHASE,
  GAME_SERVER_TICK_INTERVAL_MS,
  MIN_PLAYERS_TO_START,
  type GamePhase,
} from "@sweet-spicy/shared-types";

export { CHALLENGE_PHASE_COUNTDOWN_SECONDS, DEFAULT_ROOM_MAX_PLAYERS, MIN_PLAYERS_TO_START };

/** Phases where the virtual tabletop (opponents row, table, action log, hand strip) is shown. */
export function isTabletopLayoutPhase(phase: GamePhase): boolean {
  return phase !== GAME_PHASE.LOBBY && phase !== GAME_PHASE.END_GAME;
}

/**
 * Pause phases after round resolution: no `playedCard`, center play slot must stay empty.
 * UI hides the dashed “drop here” placeholder and vertically centers `phaseContent`.
 */
export function isRoundResolutionInterstitialPhase(phase: GamePhase): boolean {
  return (
    phase === GAME_PHASE.PENALTY ||
    phase === GAME_PHASE.NEXT_TURN ||
    phase === GAME_PHASE.TROPHY_AWARDED
  );
}

/** URL segment for “create then redirect” flow. */
export const NEW_ROOM_ROUTE_SEGMENT = "new";

/** Placeholder room code in UI before a real code exists. */
export const LOBBY_PLACEHOLDER_ROOM_CODE = "XXXX";

/** Default nickname query param fallback (i18n still labels the field). */
export const DEFAULT_LOBBY_NICKNAME = "Player";

/** Scroll target for “BLUFF!” / “My cards” on the unified play board. */
export const GAME_PLAYER_HAND_ANCHOR_ID = "game-player-hand-anchor";

/** Local seat — face-down won pile (scoring pool); round-win flight FX lands here, not on the hand. */
export const GAME_PLAYER_WON_PILE_ANCHOR_ID = "game-player-won-pile-anchor";

/** Horizontal overlap (px) for stacked face-down penalty cards in the PENALTY phase panel. */
export const PENALTY_PHASE_PILE_OVERLAP_PX = 14;

/** Max face-down cards drawn in the PENALTY pile visual (fanned stack). */
export const PENALTY_PHASE_PILE_DISPLAY_MAX = 8;

/** Compact pile: overlap vs full {@link PENALTY_PHASE_PILE_OVERLAP_PX}. */
export const PENALTY_PHASE_PILE_COMPACT_OVERLAP_RATIO = 0.86;

/** Compact pile: flight offset vs full animation initial px. */
export const PENALTY_PHASE_PILE_COMPACT_FLIGHT_RATIO = 0.78;

/** Max ghost cards in round-resolution FX (challenger takes pile) for performance. */
export const ROUND_RESOLUTION_FX_MAX_PILE_CARDS = 6;

/**
 * Minimum height for the BoardView bottom phase strip during `REVEAL` and `PENALTY` so the
 * column does not collapse while `REVEAL` has no `phaseContent`, then jump when the penalty panel
 * mounts (reserves space per content-jumping UX guidelines).
 */
export const ROUND_RESOLUTION_BOTTOM_STRIP_MIN_H = "min-h-[min(10rem,24dvh)]";

/**
 * BoardView duel band: trophy + draw rails use `absolute` with this **top** inset (not `bottom`) so
 * changing declaration / REVEAL `min-h` does not move side piles — the band top is stable.
 */
export const DUEL_SUPPLY_RAIL_ANCHOR_TOP_CLASS = "top-1 sm:top-2" as const;

/** Full-screen REVEAL impact overlay (above table; PENALTY card flights use a separate layer). */
export const CHALLENGE_REVEAL_IMPACT_Z = 62;

/** Normalized timeline: card-back flight completes before flip to drawn faces (see `RoundResolutionFxOverlay`). */
export const ROUND_RESOLUTION_DRAW_FLIP_AT = 0.68;

/**
 * Delay before inline REVEAL outcome callout starts (seconds) — roughly after the claim flip reads.
 * Tuned against {@link PLAYFIELD_REVEAL_FLIP_DURATION_SECONDS} in PlayfieldDeclaredCardFlip.
 */
export const REVEAL_OUTCOME_CALLOUT_DELAY_SECONDS = 0.72;

/**
 * Local player hand fan — matches `SpiceCard` size `hand` width (`w-[6.5rem]` / `sm:w-[8.5rem]`); height follows 2:3 art.
 * Used to compute overlap vs container width (see `PlayerHand`).
 */
export const PLAYER_HAND_CARD_WIDTH_NARROW_PX = 104;
export const PLAYER_HAND_CARD_WIDTH_WIDE_PX = 136;
/** Same breakpoint as Tailwind `sm:` for hand card width. */
export const PLAYER_HAND_FAN_MEDIA = "(min-width: 640px)" as const;

/** Minimum overlap between adjacent hand cards (px). */
export const PLAYER_HAND_FAN_LOOSE_OVERLAP_PX = 14;
/** Hard cap so at least ~one rank corner stays readable. */
export const PLAYER_HAND_FAN_MAX_OVERLAP_PX = 48;
/** Minimum visible width per stacked card (rank corner); higher = less overlap when compressed. */
export const PLAYER_HAND_FAN_MIN_VISIBLE_PX = 56;
/** Max fan rotation (deg) at each end; scaled down when many cards (see `fanRotationMaxDeg` in PlayerHand). */
export const PLAYER_HAND_FAN_ROTATION_MAX_DEG = 9;
/** Rotation scale: `min(ROTATION_MAX, ROTATION_NUMERATOR / cardCount)`. */
export const PLAYER_HAND_FAN_ROTATION_NUMERATOR = 54;

/**
 * While hovered, hand card wrapper z-index becomes `index + this` so the lifted card stays above
 * overlapping siblings; otherwise the pointer falls through and hover state flickers away (“mất” lá).
 * Must stay below {@link PLAYER_HAND_SELECTED_Z_INDEX} / {@link PLAYER_HAND_DRAGGING_Z_INDEX} ordering in PlayerHand.
 */
export const PLAYER_HAND_HOVER_Z_INDEX_BOOST = 45;

/** z-index for selected / dragging hand cards (see PlayerHand). */
export const PLAYER_HAND_SELECTED_Z_INDEX = 50;
export const PLAYER_HAND_DRAGGING_Z_INDEX = 100;

/**
 * Min height for the horizontal-scroll hand strip (card height + top slack for rotate/ring/badges + hover + shadow).
 * Hand card height is `aspect-[2/3]` at 6.5rem / 8.5rem width; extra space avoids clipping overflow above `items-end`.
 */
export const PLAYER_HAND_STRIP_MIN_HEIGHT_CLASS = "min-h-[15.5rem] sm:min-h-[18rem]" as const;

/** Framer Motion scale — center seat (hero) vs wings; strong TCG “duel field” read. */
export const OPPONENT_CAROUSEL_SCALE_CENTER = 1;
export const OPPONENT_CAROUSEL_SCALE_SIDE = 0.82;
export const OPPONENT_CAROUSEL_SCALE_FAR = 0.68;
/** Snap column — wide enough for portrait + ornate frame. */
export const OPPONENT_CAROUSEL_CELL_MIN_WIDTH_CLASS = "min-w-[10.75rem] sm:min-w-[12rem]" as const;
/** `rotateY` per index step from focused seat (subtle arc, Yu-Gi-Oh–style duel row). */
export const OPPONENT_CAROUSEL_ARC_ROTATE_DEG_PER_STEP = 8;
/** `translateZ` (px) when seat is carousel focus — pops hero toward camera. */
export const OPPONENT_CAROUSEL_FOCUS_TRANSLATE_Z_PX = 28;

/** HTML5 drag payload — hand card id (play area drop target). */
export const GAME_CARD_DRAG_MIME_TYPE = "application/x-sweet-spicy-card-id";

/** HTML5 drag from duel draw pile → drop on local hand (draw-and-pass). */
export const GAME_DRAW_PASS_DRAG_MIME_TYPE = "application/x-sweet-spicy-draw-pass";
/** Payload token — must not collide with real card ids. */
export const GAME_DRAW_PASS_DRAG_PAYLOAD = "sweet-spicy-draw-pass-v1" as const;

export function dataTransferTypeSetHasDrawPassDrag(types: readonly string[]): boolean {
  const want = GAME_DRAW_PASS_DRAG_MIME_TYPE.toLowerCase();
  return types.some((t) => t.toLowerCase() === want);
}

export function isDrawPassDropDataTransfer(dt: DataTransfer | null): boolean {
  if (!dt) return false;
  if (dt.getData(GAME_DRAW_PASS_DRAG_MIME_TYPE) === GAME_DRAW_PASS_DRAG_PAYLOAD) return true;
  return dt.getData("text/plain") === GAME_DRAW_PASS_DRAG_PAYLOAD;
}

export function getCardIdFromDragDataTransfer(dt: DataTransfer | null): string | null {
  if (!dt) return null;
  if (dt.getData(GAME_DRAW_PASS_DRAG_MIME_TYPE) === GAME_DRAW_PASS_DRAG_PAYLOAD) return null;
  const id = dt.getData(GAME_CARD_DRAG_MIME_TYPE);
  if (typeof id === "string" && id.length > 0) return id;
  const plain = dt.getData("text/plain");
  if (plain === GAME_DRAW_PASS_DRAG_PAYLOAD) return null;
  return typeof plain === "string" && plain.length > 0 ? plain : null;
}

/** Offline-only: delay before a bot plays a card. */
export const OFFLINE_BOT_ACTION_DELAY_MS = 1500;

/** Offline-only: auto-advance after REVEAL / PENALTY / NEXT_TURN (engine uses `PHASE_STEP_PAUSE_SECONDS`). */
export const OFFLINE_PHASE_AUTO_ADVANCE_MS = PHASE_STEP_PAUSE_SECONDS * 1000;

/** Offline-only: short delay before auto-accept when local challenge timer reaches zero. */
export const OFFLINE_CHALLENGE_AUTO_ACCEPT_DELAY_MS = 500;

/** Offline challenge countdown interval; matches API game loop. */
export const OFFLINE_CHALLENGE_TICK_MS = GAME_SERVER_TICK_INTERVAL_MS;

/** Bot picks truthful declaration when random exceeds this (0..1). */
export const OFFLINE_BOT_TRUTH_PLAY_THRESHOLD = 0.35;

/** Chance a bot uses draw-and-pass instead of playing (0..1); only when draw pile non-empty. */
export const OFFLINE_BOT_DRAW_PASS_CHANCE = 0.12;

/** Display names for offline AI seats (flavor names; not shown as UI copy keys). */
export const OFFLINE_BOT_DISPLAY_NAMES = [
  "Blaze",
  "Pepper",
  "Zesty",
  "Saffron",
  "Cinnamon",
] as const;
