import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { memo, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { GameCard } from "@/shared/types/game";
import { SpiceCard } from "@/features/game/components/SpiceCard";
import { staggerHandItemVariantsForIndex } from "@/features/game/animations";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";
import {
  GAME_CARD_DRAG_MIME_TYPE,
  PLAYER_HAND_CARD_WIDTH_NARROW_PX,
  PLAYER_HAND_CARD_WIDTH_WIDE_PX,
  PLAYER_HAND_FAN_LOOSE_OVERLAP_PX,
  PLAYER_HAND_FAN_MAX_OVERLAP_PX,
  PLAYER_HAND_FAN_MEDIA,
  PLAYER_HAND_FAN_MIN_VISIBLE_PX,
  PLAYER_HAND_FAN_ROTATION_MAX_DEG,
  PLAYER_HAND_FAN_ROTATION_NUMERATOR,
  PLAYER_HAND_DRAGGING_Z_INDEX,
  PLAYER_HAND_HOVER_Z_INDEX_BOOST,
  PLAYER_HAND_SELECTED_Z_INDEX,
  PLAYER_HAND_STRIP_MIN_HEIGHT_CLASS,
} from "@/lib/game-room.constants";

function handCardWidthPx(isWide: boolean): number {
  return isWide ? PLAYER_HAND_CARD_WIDTH_WIDE_PX : PLAYER_HAND_CARD_WIDTH_NARROW_PX;
}

function fanWidthPx(cardCount: number, cardWidthPx: number, overlapPx: number): number {
  if (cardCount <= 0) return 0;
  if (cardCount === 1) return cardWidthPx;
  return cardCount * cardWidthPx - (cardCount - 1) * overlapPx;
}

function computeFanOverlapPx(
  cardCount: number,
  cardWidthPx: number,
  containerInnerWidthPx: number,
): number {
  if (cardCount <= 1) return 0;

  const loose = Math.min(
    PLAYER_HAND_FAN_LOOSE_OVERLAP_PX,
    cardWidthPx - PLAYER_HAND_FAN_MIN_VISIBLE_PX,
  );
  const tightMax = Math.min(
    PLAYER_HAND_FAN_MAX_OVERLAP_PX,
    cardWidthPx - PLAYER_HAND_FAN_MIN_VISIBLE_PX,
  );

  if (containerInnerWidthPx <= 0) {
    return loose;
  }

  const widthAtLoose = fanWidthPx(cardCount, cardWidthPx, loose);
  if (widthAtLoose <= containerInnerWidthPx) {
    return loose;
  }

  const required = (cardCount * cardWidthPx - containerInnerWidthPx) / (cardCount - 1);
  const rounded = Math.round(required);
  return Math.max(loose, Math.min(tightMax, rounded));
}

function fanRotationMaxDeg(cardCount: number): number {
  if (cardCount <= 1) return 0;
  return Math.min(
    PLAYER_HAND_FAN_ROTATION_MAX_DEG,
    PLAYER_HAND_FAN_ROTATION_NUMERATOR / cardCount,
  );
}

interface PlayerHandProps {
  cards: GameCard[];
  selectedCardId: string | null;
  /** Tap / click — inspect card (detail dialog); does not auto-open declare. */
  onInspectCard: (card: GameCard) => void;
  disabled?: boolean;
  /** While a card is being dragged (for play-zone highlight). */
  onDragSessionChange?: (active: boolean) => void;
}

export const PlayerHand = memo(function PlayerHand({
  cards,
  selectedCardId,
  onInspectCard,
  disabled,
  onDragSessionChange,
}: PlayerHandProps) {
  const reduced = useReducedMotion();
  const skipNextClickRef = useRef(false);
  const prevHandKeyRef = useRef<string | null>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const cardElRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [stripWidth, setStripWidth] = useState(0);
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const isWideHand = useMediaQuery(PLAYER_HAND_FAN_MEDIA);
  const handKey = useMemo(() => cards.map((c) => c.id).join("|"), [cards]);

  useLayoutEffect(() => {
    const el = stripRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;

    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (cr) setStripWidth(Math.round(cr.width));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const cardWidthPx = handCardWidthPx(isWideHand);
  const overlapPx = useMemo(
    () => computeFanOverlapPx(cards.length, cardWidthPx, stripWidth),
    [cards.length, cardWidthPx, stripWidth],
  );

  useLayoutEffect(() => {
    const el = stripRef.current;
    if (!el || stripWidth <= 0) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    const prev = prevHandKeyRef.current;
    const handChanged = prev !== handKey;
    if (maxScroll <= 0) {
      el.scrollLeft = 0;
      prevHandKeyRef.current = handKey;
      return;
    }
    if (handChanged || prev === null) {
      el.scrollLeft = maxScroll / 2;
    }
    prevHandKeyRef.current = handKey;
  }, [handKey, stripWidth, overlapPx]);

  useLayoutEffect(() => {
    if (!selectedCardId) return;
    const el = cardElRefs.current.get(selectedCardId);
    el?.scrollIntoView({
      behavior: reduced ? "auto" : "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [selectedCardId, reduced, handKey]);

  const rotationMax = useMemo(() => fanRotationMaxDeg(cards.length), [cards.length]);

  const rotations = useMemo(() => {
    const n = cards.length;
    if (n <= 1) return [0];
    return cards.map(
      (_, i) => -rotationMax + (2 * rotationMax * i) / (n - 1),
    );
  }, [cards, rotationMax]);

  return (
    <div className="relative w-full min-w-0">
      <div className="relative w-full min-w-0" style={{ perspective: "1400px" }}>
        <div
          ref={stripRef}
          className={cn(
            "relative z-[1] flex w-full min-w-0 items-end justify-center overflow-x-auto overscroll-x-contain px-4 pb-4 pt-6 sm:px-8 sm:pb-5 sm:pt-7",
            PLAYER_HAND_STRIP_MIN_HEIGHT_CLASS,
            "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          )}
          role="list"
          aria-label="Player hand"
        >
          <div className="flex w-max max-w-none items-end justify-center px-6 sm:px-10">
            <AnimatePresence mode="popLayout">
            {cards.map((card, index) => {
              const selected = selectedCardId === card.id;
              const rotate = rotations[index] ?? 0;
              const isBeingDragged = draggedCardId === card.id;
              const isBeingHovered = hoveredCardId === card.id;
              const allowDrag = !disabled;

              const zIndex = isBeingDragged
                ? PLAYER_HAND_DRAGGING_Z_INDEX
                : selected
                  ? PLAYER_HAND_SELECTED_Z_INDEX
                  : isBeingHovered
                    ? index + PLAYER_HAND_HOVER_Z_INDEX_BOOST
                    : index;

              return (
                <motion.div
                  key={card.id}
                  ref={(node) => {
                    if (node) cardElRefs.current.set(card.id, node);
                    else cardElRefs.current.delete(card.id);
                  }}
                  variants={staggerHandItemVariantsForIndex(index, Boolean(reduced))}
                  initial="initial"
                  animate={
                    isBeingDragged
                      ? "dragging"
                      : isBeingHovered
                        ? "hovered"
                        : "animate"
                  }
                  exit={{ opacity: 0, y: 28, scale: 0.92 }}
                  whileHover={
                    !disabled && draggedCardId === null ? "hovered" : undefined
                  }
                  style={{
                    marginLeft: index === 0 ? 0 : -overlapPx,
                    zIndex,
                    rotate,
                  }}
                  className={cn(
                    "origin-bottom shrink-0",
                    isBeingDragged && "cursor-grabbing",
                    allowDrag && !isBeingDragged && "cursor-grab",
                  )}
                  role="listitem"
                >
                  <SpiceCard
                    card={card}
                    size="hand"
                    selected={selected}
                    draggable={allowDrag}
                    isHovered={isBeingHovered}
                    isDragging={isBeingDragged}
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData(GAME_CARD_DRAG_MIME_TYPE, card.id);
                      setDraggedCardId(card.id);
                      onDragSessionChange?.(true);
                    }}
                    onDragEnd={() => {
                      setDraggedCardId(null);
                      onDragSessionChange?.(false);
                      skipNextClickRef.current = true;
                      window.setTimeout(() => {
                        skipNextClickRef.current = false;
                      }, 0);
                    }}
                    onMouseEnter={() => {
                      if (!disabled) setHoveredCardId(card.id);
                    }}
                    onMouseLeave={() => setHoveredCardId(null)}
                    onTouchStart={() => {
                      if (!disabled) setHoveredCardId(card.id);
                    }}
                    onTouchEnd={() => setHoveredCardId(null)}
                    onClick={
                      disabled
                        ? undefined
                        : () => {
                            if (skipNextClickRef.current) return;
                            onInspectCard(card);
                          }
                    }
                  />
                </motion.div>
              );
            })}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
});
