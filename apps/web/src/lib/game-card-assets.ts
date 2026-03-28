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
