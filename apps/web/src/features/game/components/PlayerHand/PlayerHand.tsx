import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  memo,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
} from "react";
import { useTranslation } from "react-i18next";
import type { GameCard } from "@/shared/types/game";
import { SpiceCard } from "@/features/game/components/SpiceCard";
import { staggerHandItemVariantsForIndex } from "@/features/game/animations";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";
import {
  dataTransferTypeSetHasDrawPassDrag,
  GAME_CARD_DRAG_MIME_TYPE,
  isDrawPassDropDataTransfer,
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

export type PlayerHandDrawPassDropConfig = {
  active: boolean;
  pileDragActive: boolean;
  onDrop: () => void;
};

function handStripAcceptsDrawPassDrag(e: DragEvent, pileDragActive: boolean): boolean {
  if (pileDragActive) return true;
  return dataTransferTypeSetHasDrawPassDrag(e.dataTransfer.types);
}

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
  /** Drag draw pile onto the hand strip (draw + pass). */
  drawPassDrop?: PlayerHandDrawPassDropConfig | null;
}

export const PlayerHand = memo(function PlayerHand({
  cards,
  selectedCardId,
  onInspectCard,
  disabled,
  onDragSessionChange,
  drawPassDrop = null,
}: PlayerHandProps) {
  const { t } = useTranslation("game");
  const reduced = useReducedMotion();
  const skipNextClickRef = useRef(false);
  const dragPreviewHostRef = useRef<HTMLDivElement | null>(null);
  const prevHandKeyRef = useRef<string | null>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const cardElRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [stripWidth, setStripWidth] = useState(0);
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [drawPassHandHovered, setDrawPassHandHovered] = useState(false);
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

  useEffect(() => {
    if (!drawPassDrop?.pileDragActive) setDrawPassHandHovered(false);
  }, [drawPassDrop?.pileDragActive]);

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
            drawPassDrop?.active === true &&
              drawPassDrop.pileDragActive &&
              cn(
                "transition-[box-shadow,background-color] duration-200",
                "ring-2 ring-primary/25 ring-offset-2 ring-offset-background",
                drawPassHandHovered && "bg-primary/[0.06] ring-primary/55",
              ),
          )}
          role="list"
          aria-label={
            drawPassDrop?.active === true && drawPassDrop.pileDragActive
              ? t("table.drawPileHandDropZoneAria")
              : t("hand.playerHandAria")
          }
          onDragOverCapture={(e) => {
            if (!drawPassDrop?.active || disabled) return;
            if (!handStripAcceptsDrawPassDrag(e, drawPassDrop.pileDragActive)) return;
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = "copy";
            setDrawPassHandHovered(true);
          }}
          onDragLeave={(e) => {
            if (!drawPassDrop?.active) return;
            if (
              !drawPassDrop.pileDragActive &&
              !dataTransferTypeSetHasDrawPassDrag(e.dataTransfer.types)
            ) {
              return;
            }
            const related = e.relatedTarget as Node | null;
            if (related && e.currentTarget.contains(related)) return;
            setDrawPassHandHovered(false);
          }}
          onDropCapture={(e) => {
            if (!drawPassDrop?.active || disabled) return;
            if (!isDrawPassDropDataTransfer(e.dataTransfer)) return;
            e.preventDefault();
            e.stopPropagation();
            setDrawPassHandHovered(false);
            drawPassDrop.onDrop();
          }}
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
                    drawPassDrop?.pileDragActive === true && "pointer-events-none",
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
                      const node = e.currentTarget;
                      e.dataTransfer.effectAllowed = "copyMove";
                      e.dataTransfer.setData(GAME_CARD_DRAG_MIME_TYPE, card.id);
                      e.dataTransfer.setData("text/plain", card.id);
                      setDraggedCardId(card.id);
                      onDragSessionChange?.(true);

                      const rect = node.getBoundingClientRect();
                      const clone = node.cloneNode(true) as HTMLDivElement;
                      clone.style.boxSizing = "border-box";
                      clone.style.width = `${rect.width}px`;
                      clone.style.height = `${rect.height}px`;
                      clone.style.position = "fixed";
                      clone.style.left = "-10000px";
                      clone.style.top = "0";
                      clone.style.margin = "0";
                      clone.style.pointerEvents = "none";
                      clone.style.zIndex = "2147483647";
                      document.body.appendChild(clone);
                      void clone.offsetWidth;
                      const anchorX = Math.min(Math.max(e.clientX - rect.left, 1), Math.max(1, rect.width - 1));
                      const anchorY = Math.min(Math.max(e.clientY - rect.top, 1), Math.max(1, rect.height - 1));
                      dragPreviewHostRef.current = clone;
                      e.dataTransfer.setDragImage(clone, anchorX, anchorY);
                    }}
                    onDragEnd={() => {
                      dragPreviewHostRef.current?.remove();
                      dragPreviewHostRef.current = null;
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
