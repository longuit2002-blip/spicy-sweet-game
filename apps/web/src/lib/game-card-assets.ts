import type { GameCard, SpiceType } from "@sweet-spicy/shared-types";

/** Display-only card for tableau trophy pile — maps to {@link TROPHY_FRONT_SRC} via {@link getGameCardFrontSrc}. */
export const TABLEAU_TROPHY_DISPLAY_CARD = {
  id: "tableau-trophy-display",
  kind: "trophy",
  type: "avocado",
  number: 0,
} as const satisfies GameCard;

/**
 * Static card art under `public/game/`.
 * Suit folders: `chilis/`, `lemons/`, `avocados/` — filenames `{prefix}_{rank}.png`.
 * Special cards in `avocados/` match on-disk names (`tropy_card.png` spelling).
 *
 * **Bandwidth:** Source PNGs can be large; {@link SpiceCard} and {@link CardBackSurface} use `next/image`
 * without `unoptimized` so Next serves resized WebP/AVIF from `/_next/image` using the `sizes` hint.
 * You can still pre-shrink masters (e.g. max width 512–768px) + WebP on disk to cut repo size and cold-cache cost.
 */
export const GAME_CARD_BACK_SRC = "/game/avocados/card_back.png" as const;

const TROPHY_FRONT_SRC = "/game/avocados/tropy_card.png" as const;
const TOTAL_WILD_FRONT_SRC = "/game/avocados/supreme_card.png" as const;

const SPICE_ASSET_FOLDER: Record<SpiceType, string> = {
  chili: "chilis",
  lemon: "lemons",
  avocado: "avocados",
};

const SPICE_FILE_PREFIX: Record<SpiceType, string> = {
  chili: "chili",
  lemon: "lemon",
  avocado: "avocado",
};

/** Border / wash utility classes in `globals.css`, keyed by {@link SpiceType}. */
export const SPICE_CARD_BORDER_CLASS: Record<SpiceType, string> = {
  chili: "card-chili",
  lemon: "card-lemon",
  avocado: "card-avocado",
};

/**
 * `PLAYER_TURN` empty slot — declare context strip shell (see `.declare-context-track--*` in `globals.css`).
 */
export const SPICE_DECLARE_CONTEXT_TRACK_CLASS: Record<SpiceType, string> = {
  chili: "declare-context-track declare-context-track--chili",
  lemon: "declare-context-track declare-context-track--lemon",
  avocado: "declare-context-track declare-context-track--avocado",
};

/** Rank chip inside the strip — border / fill / glow per {@link SpiceType} (Tailwind spice tokens). */
export const SPICE_DECLARE_CONTEXT_RANK_CHIP_CLASS: Record<SpiceType, string> = {
  chili:
    "min-w-[2.75rem] rounded-md border-2 border-chili/55 bg-chili/[0.16] px-2.5 py-1 font-bold tabular-nums text-chili shadow-[0_0_22px_-6px_hsl(var(--chili)/0.55),inset_0_1px_0_hsl(var(--chili-glow)/0.35)]",
  lemon:
    "min-w-[2.75rem] rounded-md border-2 border-lemon-glow/60 bg-lemon/[0.12] px-2.5 py-1 font-bold tabular-nums text-lemon shadow-[0_0_22px_-6px_hsl(var(--lemon-glow)/0.4),inset_0_1px_0_hsl(var(--lemon-glow)/0.28)]",
  avocado:
    "min-w-[2.75rem] rounded-md border-2 border-avocado/55 bg-avocado/[0.15] px-2.5 py-1 font-bold tabular-nums text-avocado shadow-[0_0_22px_-6px_hsl(var(--avocado)/0.45),inset_0_1px_0_hsl(var(--avocado-glow)/0.32)]",
};

/** Suit label emphasis in the same strip (pairs with {@link SPICE_DECLARE_CONTEXT_TRACK_CLASS}). */
export const SPICE_DECLARE_CONTEXT_SUIT_TEXT_CLASS: Record<SpiceType, string> = {
  chili: "text-chili drop-shadow-[0_0_12px_hsl(var(--chili)/0.35)]",
  lemon: "text-lemon drop-shadow-[0_0_10px_hsl(var(--lemon-glow)/0.25)]",
  avocado: "text-avocado drop-shadow-[0_0_12px_hsl(var(--avocado)/0.3)]",
};

/** Subtle corner radius for in-hand / table cards (not “pill” cards). */
export const GAME_CARD_CORNER_CLASS = "rounded-md";

/** Slightly softer corners for large claim / tableau cards. */
export const GAME_CARD_CORNER_LG_CLASS = "rounded-lg";

/** Full-bleed card art (local hand fan — PNGs already include the frame). */
export const GAME_CARD_CORNER_SQUARE_CLASS = "rounded-none";

/**
 * Standard front PNGs under `public/game/{chilis,lemons,avocados}/` are 1024×1536 (width:height = 2:3).
 * Apply to the card box so `object-cover` fills the frame without cropping the illustration.
 */
export const GAME_CARD_ART_ASPECT_CLASS = "aspect-[2/3]" as const;

export function getGameCardFrontSrc(card: GameCard): string {
  if (card.kind === "trophy") return TROPHY_FRONT_SRC;
  if (card.kind === "total-wild") return TOTAL_WILD_FRONT_SRC;
  const folder = SPICE_ASSET_FOLDER[card.type];
  const prefix = SPICE_FILE_PREFIX[card.type];
  return `/game/${folder}/${prefix}_${card.number}.png`;
}
