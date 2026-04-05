/**
 * Viewport height thresholds for “short” layouts (tablet landscape, small laptops).
 *
 * **Sync:** Mirror pixel literals in `apps/web/src/app/globals.css`:
 * `.short-viewport-compact-*`, `.short-viewport-compact-game-table-outer`,
 * `.social-media-section-xl-short` (`(min-width: 1280px)` + `max-height`).
 */

/** Primary tier: iPad Pro–class landscape, many laptops (e.g. 1366×768). */
export const SHORT_VIEWPORT_COMPACT_MAX_HEIGHT_PX = 800;

/** Tighter tier: very short viewports. */
export const SHORT_VIEWPORT_TIGHT_MAX_HEIGHT_PX = 700;

/** xl sidebar visible — match Tailwind `min-width: 1280px`. */
export const SHORT_VIEWPORT_SIDEBAR_MIN_WIDTH_PX = 1280;

/**
 * Tailwind arbitrary media overrides for declaration playfield `min-h` stacks.
 * Uses `!` so they win over `lg:min-h-[…]` when width is still large.
 *
 * **Sync:** media queries use the same px as {@link SHORT_VIEWPORT_COMPACT_MAX_HEIGHT_PX} /
 * {@link SHORT_VIEWPORT_TIGHT_MAX_HEIGHT_PX}.
 */
export const SHORT_VIEWPORT_DECLARATION_PLAYFIELD_MIN_H_OVERRIDE_CLASS =
  "[@media(max-height:800px)]:!min-h-[min(30dvh,12rem)] [@media(max-height:700px)]:!min-h-[min(26dvh,10rem)]" as const;

/** Outer GameTable wrapper `min-h`. */
export const SHORT_VIEWPORT_GAME_TABLE_OUTER_MIN_H_OVERRIDE_CLASS =
  "[@media(max-height:800px)]:!min-h-[min(26dvh,9rem)] [@media(max-height:700px)]:!min-h-[min(22dvh,8rem)]" as const;

/** Hand strip — complements `.short-viewport-compact-hand` padding in globals.css. */
export const SHORT_VIEWPORT_HAND_STRIP_MIN_H_OVERRIDE_CLASS =
  "[@media(max-height:800px)]:!min-h-[11rem] [@media(max-height:700px)]:!min-h-[10rem]" as const;

/** `TROPHY_AWARDED` / round-resolution center shell. */
export const SHORT_VIEWPORT_ROUND_RESOLUTION_SHELL_MIN_H_OVERRIDE_CLASS =
  "[@media(max-height:800px)]:!min-h-[min(36dvh,18rem)] [@media(max-height:700px)]:!min-h-[min(30dvh,14rem)]" as const;

/** Trophy rail anchor cell — less vertical reserve when the viewport is short. */
export const SHORT_VIEWPORT_ROUND_PILE_RAIL_MIN_H_OVERRIDE_CLASS =
  "[@media(max-height:800px)]:!min-h-[6.75rem] [@media(max-height:700px)]:!min-h-[6rem]" as const;

/** Draw / trophy tableau column stack area. */
export const SHORT_VIEWPORT_TABLEAU_PILE_STACK_MIN_H_OVERRIDE_CLASS =
  "[@media(max-height:800px)]:!min-h-[6.25rem] [@media(max-height:700px)]:!min-h-[5.5rem]" as const;

/** Bottom strip when round-resolution `phaseContent` is interstitial. */
export const SHORT_VIEWPORT_ROUND_RESOLUTION_BOTTOM_STRIP_MIN_H_OVERRIDE_CLASS =
  "[@media(max-height:800px)]:!min-h-[min(6rem,18dvh)] [@media(max-height:700px)]:!min-h-[min(5rem,16dvh)]" as const;

/** Marker classes — rules live in globals.css `@media (max-height: …)`. */
export const SHORT_VIEWPORT_COMPACT_PLAYFIELD_CLASS =
  "short-viewport-compact-playfield" as const;
export const SHORT_VIEWPORT_COMPACT_HAND_CLASS = "short-viewport-compact-hand" as const;
export const SHORT_VIEWPORT_COMPACT_OPPONENTS_CLASS =
  "short-viewport-compact-opponents" as const;
export const SHORT_VIEWPORT_COMPACT_GAME_TABLE_OUTER_CLASS =
  "short-viewport-compact-game-table-outer" as const;

// ---------------------------------------------------------------------------
// Width band: xl but below Tailwind `2xl` (1536px) — e.g. 1366×768 + sidebar
// ---------------------------------------------------------------------------

const TABLETOP_LAPTOP_W =
  "[@media(min-width:1280px)_and_(max-width:1535px)]" as const;

/** Lower bound (px) — matches Tailwind `xl`. */
export const TABLETOP_LAPTOP_WIDTH_BAND_MIN_PX = 1280;

/** Upper bound (px) — one px below Tailwind `2xl` / 1536px. */
export const TABLETOP_LAPTOP_WIDTH_BAND_MAX_PX = 1535;

/** Denser tabletop: claim / duel / rails / hand fallback (`!` overrides `xl:` steps). */
export const TABLETOP_LAPTOP_CLAIM_CARD_W_CLASS =
  `${TABLETOP_LAPTOP_W}:!w-[10rem]` as const;

export const TABLETOP_LAPTOP_DUEL_CARD_W_CLASS =
  `${TABLETOP_LAPTOP_W}:!w-[7rem]` as const;
export const TABLETOP_LAPTOP_DUEL_CARD_H_CLASS =
  `${TABLETOP_LAPTOP_W}:!h-[10.5rem]` as const;

export const TABLETOP_LAPTOP_TABLEAU_FACE_DOWN_W_CLASS =
  `${TABLETOP_LAPTOP_W}:!w-[7rem]` as const;
export const TABLETOP_LAPTOP_TABLEAU_FACE_DOWN_H_CLASS =
  `${TABLETOP_LAPTOP_W}:!h-[10.5rem]` as const;

export const TABLETOP_LAPTOP_ROUND_STACK_VIEWPORT_W_CLASS =
  `${TABLETOP_LAPTOP_W}:!w-[6.125rem]` as const;
export const TABLETOP_LAPTOP_ROUND_STACK_VIEWPORT_H_CLASS =
  `${TABLETOP_LAPTOP_W}:!h-[8.75rem]` as const;

export const TABLETOP_LAPTOP_ROUND_CARD_BOX_W_CLASS =
  `${TABLETOP_LAPTOP_W}:!w-[5.5rem]` as const;

export const TABLETOP_LAPTOP_SIDE_RAIL_GAP_X_CLASS =
  `${TABLETOP_LAPTOP_W}:!gap-x-3` as const;

export const TABLETOP_LAPTOP_OPPONENT_CELL_MIN_W_CLASS =
  `${TABLETOP_LAPTOP_W}:!min-w-[10.5rem]` as const;

export const TABLETOP_LAPTOP_HAND_FALLBACK_W_CLASS =
  `${TABLETOP_LAPTOP_W}:!w-[7.75rem]` as const;

/** Scales measured hand card width from `handCardWidthFromStripPx` when the laptop width band matches. */
export const TABLETOP_LAPTOP_HAND_MEASURED_WIDTH_SCALE_RATIO = 0.92;

/** Declare chain strip: emoji / suit / rank scale down in the laptop band. */
export const TABLETOP_LAPTOP_DECLARE_CHAIN_EMOJI_CLASS =
  `${TABLETOP_LAPTOP_W}:!text-2xl` as const;
export const TABLETOP_LAPTOP_DECLARE_CHAIN_SUIT_TEXT_CLASS =
  `${TABLETOP_LAPTOP_W}:!text-sm` as const;
export const TABLETOP_LAPTOP_DECLARE_CHAIN_RANK_CLASS =
  `${TABLETOP_LAPTOP_W}:!text-xl` as const;

/** Rank chip shell in strip (pairs with {@link SPICE_DECLARE_CONTEXT_RANK_CHIP_CLASS}). */
export const TABLETOP_LAPTOP_DECLARE_RANK_CHIP_DENSE_CLASS =
  `${TABLETOP_LAPTOP_W}:!min-w-[2.5rem] ${TABLETOP_LAPTOP_W}:!px-2 ${TABLETOP_LAPTOP_W}:!py-1` as const;

/** Opponent seat bubble — avatar circle (see OpponentSeatBubble). */
export const TABLETOP_LAPTOP_OPPONENT_AVATAR_FRAME_CLASS =
  `${TABLETOP_LAPTOP_W}:!h-[3.5rem] ${TABLETOP_LAPTOP_W}:!w-[3.5rem]` as const;

export const TABLETOP_LAPTOP_OPPONENT_INITIAL_LETTER_CLASS =
  `${TABLETOP_LAPTOP_W}:!text-2xl` as const;

export const TABLETOP_LAPTOP_OPPONENT_NAME_PLATE_CLASS =
  `${TABLETOP_LAPTOP_W}:!w-[min(100%,7.5rem)] ${TABLETOP_LAPTOP_W}:!py-0 ${TABLETOP_LAPTOP_W}:!pb-1.5 ${TABLETOP_LAPTOP_W}:!pt-2` as const;

export const TABLETOP_LAPTOP_OPPONENT_STATS_BLOCK_CLASS =
  `${TABLETOP_LAPTOP_W}:!max-w-[6.75rem]` as const;
