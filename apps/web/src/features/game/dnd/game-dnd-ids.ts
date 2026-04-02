/**
 * Stable ids and drag payloads for @dnd-kit — single source of truth for hand / draw pile / play zone.
 */

export const GAME_DND_DRAG_DRAW_PASS_ID = "game-dnd-draw-pass-pile" as const;

export const GAME_DND_DROP_HAND_DRAW_PASS = "game-dnd-drop-hand-draw-pass" as const;

export const GAME_DND_DROP_PLAY_ZONE = "game-dnd-drop-play-zone" as const;

/** Minimum pointer movement before a drag activates (avoids stealing taps / tooltips). */
export const GAME_DND_POINTER_ACTIVATION_DISTANCE_PX = 8;

/** Touch: brief hold before drag starts so horizontal hand-scroll can win for small moves. */
export const GAME_DND_TOUCH_ACTIVATION_DELAY_MS = 200;

export const GAME_DND_TOUCH_ACTIVATION_TOLERANCE_PX = 6;

/** Draw pile on-table visual dims while a single-card {@link DragOverlay} tracks the pointer. */
export const GAME_DND_DRAW_PASS_SOURCE_DIM_OPACITY = 0.42;

export const GAME_DND_KIND = {
  DRAW_PASS: "draw-pass",
  DECLARE_CARD: "declare-card",
} as const;

export type GameDndDrawPassDragData = { kind: typeof GAME_DND_KIND.DRAW_PASS };

export type GameDndDeclareCardDragData = {
  kind: typeof GAME_DND_KIND.DECLARE_CARD;
  cardId: string;
};

export function gameDndDeclareCardDragId(cardId: string): string {
  return `game-dnd-declare-card:${cardId}`;
}

export function isGameDndDrawPassData(data: unknown): data is GameDndDrawPassDragData {
  return (
    typeof data === "object" &&
    data !== null &&
    "kind" in data &&
    (data as { kind: unknown }).kind === GAME_DND_KIND.DRAW_PASS
  );
}

export function isGameDndDeclareCardData(data: unknown): data is GameDndDeclareCardDragData {
  if (typeof data !== "object" || data === null || !("kind" in data)) return false;
  const rec = data as { kind: unknown; cardId?: unknown };
  return rec.kind === GAME_DND_KIND.DECLARE_CARD && typeof rec.cardId === "string" && rec.cardId.length > 0;
}
