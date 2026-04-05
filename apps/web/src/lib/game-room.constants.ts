import {
  CHALLENGE_PHASE_COUNTDOWN_SECONDS,
  PENALTY_PHASE_PAUSE_SECONDS,
  PHASE_STEP_PAUSE_SECONDS,
  REVEAL_LOCK_COUNTDOWN_SECONDS,
  REVEAL_PHASE_COUNTDOWN_SECONDS,
  REVEAL_REMAIN_AFTER_LOCK_THRESHOLD,
} from "@sweet-spicy/game-logic";
import {
  DEFAULT_ROOM_MAX_PLAYERS,
  GAME_PHASE,
  GAME_SERVER_TICK_INTERVAL_MS,
  MIN_PLAYERS_TO_START,
  type GamePhase,
} from "@sweet-spicy/shared-types";

import {
  SHORT_VIEWPORT_DECLARATION_PLAYFIELD_MIN_H_OVERRIDE_CLASS,
  SHORT_VIEWPORT_GAME_TABLE_OUTER_MIN_H_OVERRIDE_CLASS,
  SHORT_VIEWPORT_HAND_STRIP_MIN_H_OVERRIDE_CLASS,
  SHORT_VIEWPORT_ROUND_PILE_RAIL_MIN_H_OVERRIDE_CLASS,
  SHORT_VIEWPORT_ROUND_RESOLUTION_BOTTOM_STRIP_MIN_H_OVERRIDE_CLASS,
  SHORT_VIEWPORT_ROUND_RESOLUTION_SHELL_MIN_H_OVERRIDE_CLASS,
  SHORT_VIEWPORT_TABLEAU_PILE_STACK_MIN_H_OVERRIDE_CLASS,
  TABLETOP_LAPTOP_CLAIM_CARD_W_CLASS,
  TABLETOP_LAPTOP_DUEL_CARD_H_CLASS,
  TABLETOP_LAPTOP_DUEL_CARD_W_CLASS,
  TABLETOP_LAPTOP_HAND_FALLBACK_W_CLASS,
  TABLETOP_LAPTOP_OPPONENT_CELL_MIN_W_CLASS,
  TABLETOP_LAPTOP_ROUND_CARD_BOX_W_CLASS,
  TABLETOP_LAPTOP_ROUND_STACK_VIEWPORT_H_CLASS,
  TABLETOP_LAPTOP_ROUND_STACK_VIEWPORT_W_CLASS,
  TABLETOP_LAPTOP_SIDE_RAIL_GAP_X_CLASS,
  TABLETOP_LAPTOP_TABLEAU_FACE_DOWN_H_CLASS,
  TABLETOP_LAPTOP_TABLEAU_FACE_DOWN_W_CLASS,
} from "./viewport-layout.constants";

export {
  CHALLENGE_PHASE_COUNTDOWN_SECONDS,
  DEFAULT_ROOM_MAX_PLAYERS,
  MIN_PLAYERS_TO_START,
  PENALTY_PHASE_PAUSE_SECONDS,
  REVEAL_LOCK_COUNTDOWN_SECONDS,
  REVEAL_PHASE_COUNTDOWN_SECONDS,
  REVEAL_REMAIN_AFTER_LOCK_THRESHOLD,
};

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

/** Home launcher query param for prefilled room codes. */
export const ROOM_CODE_SEARCH_PARAM = "roomCode";

/** Optional room-entry query param for prefilled player names on direct links. */
export const ROOM_NICKNAME_SEARCH_PARAM = "nick";

/** Default nickname query param fallback (i18n still labels the field). */
export const DEFAULT_LOBBY_NICKNAME = "Player";

/** Web form cap for player-visible nickname entry. */
export const PLAYER_NICKNAME_MAX_LENGTH = 16;

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
 * Minimum height for the BoardView bottom phase strip when interstitial `phaseContent` can appear
 * (e.g. `TROPHY_AWARDED`) so the column does not collapse between beats.
 */
export const ROUND_RESOLUTION_BOTTOM_STRIP_MIN_H =
  `min-h-[min(10rem,24dvh)] ${SHORT_VIEWPORT_ROUND_RESOLUTION_BOTTOM_STRIP_MIN_H_OVERRIDE_CLASS}` as const;

/**
 * BoardView duel rails: `top-1/2 -translate-y-1/2` on the **tall** `relative flex-1` playfield wrapper (declaration + scroll).
 * Both columns share the same vertical midpoint in the visible playfield column; mount against a short band alone and rails
 * will not track “center of board”.
 */
export const DUEL_SUPPLY_RAIL_ANCHOR_VERTICAL_CENTER_CLASS =
  "top-1/2 -translate-y-1/2" as const;

/** Top-align rails to a short containing block (e.g. prototypes); BoardView duel rails use {@link DUEL_SUPPLY_RAIL_ANCHOR_VERTICAL_CENTER_CLASS}. */
export const DUEL_SUPPLY_RAIL_ANCHOR_TOP_ALIGN_CLASS = "top-0" as const;

/** @alias {@link DUEL_SUPPLY_RAIL_ANCHOR_TOP_ALIGN_CLASS} — name kept for search. */
export const DUEL_SUPPLY_RAIL_ANCHOR_TOP_TROPHY_CLASS =
  DUEL_SUPPLY_RAIL_ANCHOR_TOP_ALIGN_CLASS;

/** Reference width for absolute duel rails vs {@link PLAYFIELD_SIDE_RAIL_GRID_CLASS} (not applied as a flow column in BoardView). */
export const DUEL_SUPPLY_RAIL_TRACK_W_CLASS =
  "w-[7.25rem] min-w-0 sm:w-[8.25rem] md:w-[9rem]" as const;

/** Full-screen REVEAL impact overlay (above table; PENALTY card flights use a separate layer). */
export const CHALLENGE_REVEAL_IMPACT_Z = 62;

/**
 * PENALTY round-result copy + dimmer — **below** {@link ROUND_RESOLUTION_FX_Z} so pile/draw card flights stay on top.
 */
export const PENALTY_RESULT_IMPACT_Z = 58;

/** z-index for {@link RoundResolutionFxOverlay} card flights (above {@link PENALTY_RESULT_IMPACT_Z}). */
export const ROUND_RESOLUTION_FX_Z = 60;

/**
 * After the reveal outcome mounts, auto-dismiss the overlay (ms). Server `REVEAL_POST_LOCK_HOLD_SECONDS`
 * is tuned so PENALTY follows shortly after this beat (same phase window as the 3s flip).
 */
export const CHALLENGE_REVEAL_IMPACT_HOLD_MS = 2800;

/** Full-screen `NEXT_TURN` stinger overlay duration (ms); tuned under the ~2s inter-phase pause. */
export const NEXT_TURN_IMPACT_HOLD_MS = 1900;

/** Normalized timeline: card-back flight completes before flip to drawn faces (see `RoundResolutionFxOverlay`). */
export const ROUND_RESOLUTION_DRAW_FLIP_AT = 0.68;

/**
 * Delay before inline REVEAL outcome callout starts (seconds) — roughly after the claim flip reads.
 * Tuned against {@link PLAYFIELD_REVEAL_FLIP_DURATION_SECONDS} in PlayfieldDeclaredCardFlip.
 */
export const REVEAL_OUTCOME_CALLOUT_DELAY_SECONDS = 0.72;

/**
 * Local player hand fan — matches `SpiceCard` size `hand` width at the narrow/wide ends of
 * {@link handCardWidthFromStripPx}; height follows 2:3 art.
 */
export const PLAYER_HAND_CARD_WIDTH_NARROW_PX = 92;
export const PLAYER_HAND_CARD_WIDTH_WIDE_PX = 122;

/** Floor for hand card width (px) when the strip is very narrow. */
export const PLAYER_HAND_CARD_WIDTH_MIN_PX = 76;

/** Strip inner width (px): blended width equals {@link PLAYER_HAND_CARD_WIDTH_NARROW_PX}. */
export const PLAYER_HAND_STRIP_BLEND_LOW_PX = 240;

/** Strip inner width (px): blended width equals {@link PLAYER_HAND_CARD_WIDTH_WIDE_PX}. */
export const PLAYER_HAND_STRIP_BLEND_HIGH_PX = 500;

export function handCardWidthFromStripPx(stripInnerWidthPx: number): number {
  if (stripInnerWidthPx <= 0) {
    return PLAYER_HAND_CARD_WIDTH_NARROW_PX;
  }
  const low = PLAYER_HAND_STRIP_BLEND_LOW_PX;
  const high = PLAYER_HAND_STRIP_BLEND_HIGH_PX;
  const t = Math.min(1, Math.max(0, (stripInnerWidthPx - low) / (high - low)));
  const blended =
    PLAYER_HAND_CARD_WIDTH_NARROW_PX +
    t * (PLAYER_HAND_CARD_WIDTH_WIDE_PX - PLAYER_HAND_CARD_WIDTH_NARROW_PX);
  return Math.round(
    Math.max(
      PLAYER_HAND_CARD_WIDTH_MIN_PX,
      Math.min(PLAYER_HAND_CARD_WIDTH_WIDE_PX, blended),
    ),
  );
}

/** Minimum overlap between adjacent hand cards (px). */
export const PLAYER_HAND_FAN_LOOSE_OVERLAP_PX = 14;
/** Hard cap so at least ~one rank corner stays readable. */
export const PLAYER_HAND_FAN_MAX_OVERLAP_PX = 48;
/** Minimum visible width per stacked card (rank corner); higher = less overlap when compressed. */
export const PLAYER_HAND_FAN_MIN_VISIBLE_PX = 50;
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
 * Hand card height is `aspect-[2/3]` from {@link handCardWidthFromStripPx} / {@link SPICE_CARD_HAND_FALLBACK_WIDTH_CLASS}; extra space avoids clipping above `items-end`.
 */
export const PLAYER_HAND_STRIP_MIN_HEIGHT_CLASS =
  `min-h-[12.5rem] sm:min-h-[15rem] md:min-h-[18rem] ${SHORT_VIEWPORT_HAND_STRIP_MIN_H_OVERRIDE_CLASS}` as const;

/** Framer Motion scale — center seat (hero) vs wings; strong TCG “duel field” read. */
export const OPPONENT_CAROUSEL_SCALE_CENTER = 1;
export const OPPONENT_CAROUSEL_SCALE_SIDE = 0.82;
export const OPPONENT_CAROUSEL_SCALE_FAR = 0.68;
/** Snap column — wide enough for portrait + ornate frame. */
export const OPPONENT_CAROUSEL_CELL_MIN_WIDTH_CLASS =
  `min-w-[9rem] sm:min-w-[10.75rem] lg:min-w-[12rem] ${TABLETOP_LAPTOP_OPPONENT_CELL_MIN_W_CLASS}` as const;
/** `rotateY` per index step from focused seat (subtle arc, Yu-Gi-Oh–style duel row). */
export const OPPONENT_CAROUSEL_ARC_ROTATE_DEG_PER_STEP = 8;
/** `translateZ` (px) when seat is carousel focus — pops hero toward camera. */
export const OPPONENT_CAROUSEL_FOCUS_TRANSLATE_Z_PX = 28;

/** Auto-dismiss overlay hint when draw-and-pass becomes available on your turn (ms). */
export const DRAW_PASS_COACH_HINT_DISPLAY_MS = 4800;

/**
 * After the declare-rule toast mounts, wait this long before showing the draw-pile drag coach
 * so the player reads one hint at a time (local `PLAYER_TURN` only).
 */
export const DRAW_PASS_COACH_HINT_REVEAL_DELAY_MS = 1400;

/**
 * Empty `PLAYER_TURN` declare shell — shorter than {@link DECLARATION_PLAYFIELD_MIN_H_PLAYED_CLAIM_CLASS}
 * so chain + drop slot do not sit in an oversized vertical frame on laptop viewports.
 */
export const DECLARATION_PLAYFIELD_MIN_H_EMPTY_PLAYER_TURN_CLASS =
  `min-h-[min(34dvh,19rem)] sm:min-h-[min(46dvh,30rem)] lg:min-h-[min(52dvh,36rem)] ${SHORT_VIEWPORT_DECLARATION_PLAYFIELD_MIN_H_OVERRIDE_CLASS}` as const;

/** Offline-only: delay before a bot plays a card. */
export const OFFLINE_BOT_ACTION_DELAY_MS = 1500;

/**
 * Offline-only: auto-advance after `NEXT_TURN` / `TROPHY_AWARDED` (engine uses {@link PHASE_STEP_PAUSE_SECONDS}).
 */
export const OFFLINE_PHASE_AUTO_ADVANCE_MS = PHASE_STEP_PAUSE_SECONDS * 1000;

/** Offline-only: `PENALTY` dwell — keep aligned with {@link PENALTY_PHASE_PAUSE_SECONDS}. */
export const OFFLINE_PENALTY_PHASE_AUTO_ADVANCE_MS = PENALTY_PHASE_PAUSE_SECONDS * 1000;

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

// --- GameTable / playfield layout (Tailwind class strings; avoid duplicated literals in GameTable) ---

/** When a claim is on the table: min-height by breakpoint so the column does not jump across phases. */
export const DECLARATION_PLAYFIELD_MIN_H_PLAYED_CLAIM_CLASS =
  `min-h-[min(40dvh,22rem)] sm:min-h-[min(52vh,34rem)] lg:min-h-[min(58vh,40rem)] ${SHORT_VIEWPORT_DECLARATION_PLAYFIELD_MIN_H_OVERRIDE_CLASS}` as const;

/**
 * Shared shell body for declare / played-claim playfield (max-w, gap, py, perspective).
 * Pair with {@link DECLARATION_PLAYFIELD_MIN_H_PLAYED_CLAIM_CLASS} + `justify-*` for full parity with empty layout.
 */
export const DECLARATION_PLAYFIELD_SHELL_SHARED_BODY_CLASS =
  "relative z-10 mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col gap-3 [perspective:1200px] py-2 sm:py-4 lg:max-w-4xl" as const;

/** Center shell — empty PLAYER_TURN + shared vertical rhythm with played claim. */
export const DECLARATION_PLAYFIELD_SHELL_EMPTY_LAYOUT_CLASS =
  `${DECLARATION_PLAYFIELD_SHELL_SHARED_BODY_CLASS} justify-center ${DECLARATION_PLAYFIELD_MIN_H_EMPTY_PLAYER_TURN_CLASS}` as const;

/**
 * Center column during `PENALTY` / `NEXT_TURN` when round copy is **portal-only** (no `roundResolutionPanel`).
 * Omit {@link DECLARATION_PLAYFIELD_MIN_H_PLAYED_CLAIM_CLASS} so the playfield does not jump from the compact REVEAL band
 * into a tall empty placeholder.
 */
export const DECLARATION_PLAYFIELD_SHELL_PORTAL_INTERSTITIAL_CLASS =
  `${DECLARATION_PLAYFIELD_SHELL_SHARED_BODY_CLASS} justify-center min-h-0` as const;

/** Center column width — claim stack + PLAYER_TURN slot (matches across `GameTableDeclarationSection` branches). */
export const PLAYFIELD_DECLARE_CENTER_STACK_MAX_W_CLASS =
  "max-w-[min(100%,20rem)] sm:max-w-[min(100%,24rem)] xl:max-w-[min(100%,26rem)]" as const;

/** Vertical gap between declare copy / chain strip and card or slot (matches played-claim `motion.div`). */
export const PLAYFIELD_DECLARE_CENTER_STACK_GAP_CLASS = "gap-2 sm:gap-2.5" as const;

/** Wide overlay for declare hint toast only (does not widen the card column). */
export const PLAYFIELD_DECLARE_HINT_TOAST_OUTER_W_CLASS =
  "w-[min(100%,32rem)] max-w-[32rem]" as const;

/**
 * When `lockedSuit` is null, reserve space ≈ “current claim” two-line block so the drop slot aligns
 * with the played-claim card vertical rhythm.
 */
export const PLAYFIELD_DECLARE_EMPTY_HEADER_PLACEHOLDER_MIN_H_CLASS =
  "min-h-[3.5rem] sm:min-h-[4rem]" as const;

/** Wider shell for in-flow round-resolution panel (`TROPHY_AWARDED`; merged `phaseContent`). */
export const DECLARATION_PLAYFIELD_SHELL_ROUND_RESOLUTION_LAYOUT_CLASS =
  `relative z-10 mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col justify-center gap-3 [perspective:1200px] py-2 min-h-[min(45dvh,26rem)] sm:min-h-[min(56vh,38rem)] sm:py-4 lg:max-w-6xl lg:min-h-[min(62vh,44rem)] xl:max-w-7xl ${SHORT_VIEWPORT_ROUND_RESOLUTION_SHELL_MIN_H_OVERRIDE_CLASS}` as const;

/** Side rails: fixed rem tracks on small screens so center column stays stable. */
export const PLAYFIELD_SIDE_RAIL_GRID_CLASS =
  `grid w-full min-w-0 flex-1 grid-cols-[7.25rem_minmax(0,1fr)] items-start gap-x-2 gap-y-2 sm:grid-cols-[8.25rem_minmax(0,1fr)_8.25rem] md:grid-cols-[9rem_minmax(0,1fr)_9rem] sm:gap-x-2 sm:gap-y-0 lg:gap-x-4 ${TABLETOP_LAPTOP_SIDE_RAIL_GAP_X_CLASS}` as const;

/** Round pile anchor cell — height for stack + chip. */
export const PLAYFIELD_ROUND_PILE_ANCHOR_CELL_CLASS =
  `col-start-1 row-start-1 flex w-full min-w-0 shrink-0 items-start justify-end self-start pr-0.5 sm:pr-2 min-h-[8rem] min-[420px]:min-h-[8.75rem] sm:min-h-[10.5rem] md:min-h-[11.75rem] lg:min-h-[12rem] ${SHORT_VIEWPORT_ROUND_PILE_RAIL_MIN_H_OVERRIDE_CLASS}` as const;

/**
 * Claim card / empty drop slot width (declare → challenge → reveal).
 * Laptop widths (lg without xl) stay closer to side rails — avoid a single `lg:` jump to an oversized hero card.
 */
export const PLAYFIELD_CLAIM_CARD_WIDTH_PLAYED_CLASS =
  `w-[8.5rem] min-[420px]:w-[9rem] sm:w-[9.75rem] md:w-[10.25rem] lg:w-[10.75rem] xl:w-[11.5rem] 2xl:w-[12.75rem] ${TABLETOP_LAPTOP_CLAIM_CARD_W_CLASS}` as const;

/** Contested pile decorative stack viewport (face-down layers). */
export const PLAYFIELD_ROUND_STACK_VIEWPORT_CLASS =
  `relative h-[7.25rem] w-[4.875rem] shrink-0 overflow-visible rounded-lg bg-transparent min-[420px]:h-[8.25rem] min-[420px]:w-[5.5rem] sm:h-[8.75rem] sm:w-[6.25rem] md:h-[9.75rem] md:w-[6.875rem] lg:h-[10rem] lg:w-[7rem] ${TABLETOP_LAPTOP_ROUND_STACK_VIEWPORT_W_CLASS} ${TABLETOP_LAPTOP_ROUND_STACK_VIEWPORT_H_CLASS}` as const;

/** Width classes for round-pile card backs inside {@link PLAYFIELD_ROUND_STACK_VIEWPORT_CLASS} (pairs with aspect 2/3). */
export const PLAYFIELD_ROUND_CARD_BOX_WIDTH_CLASS =
  `w-[3.875rem] min-[420px]:w-[4.625rem] sm:w-[5.25rem] md:w-[6rem] lg:w-[6.25rem] ${TABLETOP_LAPTOP_ROUND_CARD_BOX_W_CLASS}` as const;

/** Tableau pile column: label + stack vertical space. */
export const PLAYFIELD_TABLEAU_PILE_STACK_AREA_CLASS =
  `flex min-h-[7.5rem] flex-col items-center justify-end min-[420px]:min-h-[8.25rem] sm:min-h-[9.5rem] md:min-h-[10.5rem] ${SHORT_VIEWPORT_TABLEAU_PILE_STACK_MIN_H_OVERRIDE_CLASS}` as const;

/** Face-down stack footprint in supply rails (matches {@link SPICE_CARD_TABLEAU_WIDTH_CLASS}). */
export const TABLEAU_FACE_DOWN_CARD_W_CLASS =
  `w-[5.5rem] min-[420px]:w-[6.25rem] sm:w-[7.25rem] md:w-[8rem] ${TABLETOP_LAPTOP_TABLEAU_FACE_DOWN_W_CLASS}` as const;
export const TABLEAU_FACE_DOWN_CARD_H_CLASS =
  `h-[8.25rem] min-[420px]:h-[9.375rem] sm:h-[10.875rem] md:h-[12rem] ${TABLETOP_LAPTOP_TABLEAU_FACE_DOWN_H_CLASS}` as const;
/** Inset between decorative face-down layers in supply rails (px). */
export const TABLEAU_FACE_DOWN_LAYER_OFFSET_PX = 3.5;

/** Duel supply columns (matches {@link SPICE_CARD_DUEL_WIDTH_CLASS}); decorative stack layers reuse these same w/h classes as the top card-back surface. */
export const DUEL_TABLEAU_CARD_W_CLASS =
  `w-[4.25rem] min-[420px]:w-[5.25rem] sm:w-[5.75rem] md:w-[6.75rem] lg:w-[7.5rem] xl:w-[8rem] 2xl:w-[8.75rem] ${TABLETOP_LAPTOP_DUEL_CARD_W_CLASS}` as const;
export const DUEL_TABLEAU_CARD_H_CLASS =
  `h-[6.375rem] min-[420px]:h-[7.875rem] sm:h-[8.625rem] md:h-[10.125rem] lg:h-[11.25rem] xl:h-[12rem] 2xl:h-[13.125rem] ${TABLETOP_LAPTOP_DUEL_CARD_H_CLASS}` as const;
export const DUEL_TABLEAU_LAYER_OFFSET_PX = 4;

/**
 * Empty `PLAYER_TURN` declare drop slot — same footprint as the played-claim card so the center slot
 * does not jump between “current claim” and “drag a card here” states.
 */
export const PLAYFIELD_DECLARE_DROP_SLOT_WIDTH_CLASS =
  PLAYFIELD_CLAIM_CARD_WIDTH_PLAYED_CLASS;

export const GAME_TABLE_LOBBY_SHELL_MIN_H_CLASS =
  "min-h-[min(28dvh,11rem)] sm:min-h-[200px] md:min-h-[220px]" as const;

export const GAME_TABLE_PLAYFIELD_OUTER_MIN_H_CLASS =
  `min-h-[min(32dvh,12rem)] sm:min-h-[200px] md:min-h-[240px] ${SHORT_VIEWPORT_GAME_TABLE_OUTER_MIN_H_OVERRIDE_CLASS}` as const;

/** SpiceCard `hand` fallback when strip width is unknown — keep aligned with {@link handCardWidthFromStripPx} end states. */
export const SPICE_CARD_HAND_FALLBACK_WIDTH_CLASS =
  `w-[5.25rem] min-[420px]:w-[5.75rem] sm:w-[7.5rem] md:w-[8.5rem] ${TABLETOP_LAPTOP_HAND_FALLBACK_W_CLASS}` as const;

/** SpiceCard `tableau` — same footprint as {@link TABLEAU_FACE_DOWN_CARD_W_CLASS}. */
export const SPICE_CARD_TABLEAU_WIDTH_CLASS = TABLEAU_FACE_DOWN_CARD_W_CLASS;

/** SpiceCard `duel` — same footprint as {@link DUEL_TABLEAU_CARD_W_CLASS}. */
export const SPICE_CARD_DUEL_WIDTH_CLASS = DUEL_TABLEAU_CARD_W_CLASS;

/** CHALLENGE PICK — card-like targets (shared min-height / padding; borders added in component). */
export const CHALLENGE_PICK_STANDALONE_TILE_SURFACE_CLASS =
  "flex aspect-[4/5] min-h-[6.75rem] w-full flex-col items-center justify-center gap-2 rounded-md p-3 text-center sm:min-h-[8rem] sm:gap-2.5 sm:p-4 md:min-h-[8.25rem]" as const;

export const CHALLENGE_PICK_STANDALONE_TILE_MAX_W_CLASS = "max-w-[11.25rem] sm:max-w-[13rem]" as const;

// ---------------------------------------------------------------------------
// PWA & touch constants
// ---------------------------------------------------------------------------

/** Minimum touch-target size (px) per WCAG 2.5.5 — applied to all interactive elements on mobile. */
export const TOUCH_TARGET_MIN_SIZE_PX = 44;

/** Duration (ms) the install-prompt banner stays hidden after the user dismisses it (7 days). */
export const PWA_INSTALL_DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

/** Service Worker cache version — bump when cache schema changes to force a full re-cache. */
export const SW_CACHE_VERSION = 1;
