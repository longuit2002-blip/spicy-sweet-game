import { useDraggable, useDndContext, useDndMonitor, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  memo,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import { useTranslation } from "react-i18next";
import type { GameCard } from "@/shared/types/game";
import { SpiceCard } from "@/features/game/components/SpiceCard";
import { staggerHandItemVariantsForIndex } from "@/features/game/animations";
import {
  GAME_DND_DROP_HAND_DRAW_PASS,
  GAME_DND_KIND,
  gameDndDeclareCardDragId,
  isGameDndDeclareCardData,
  isGameDndDrawPassData,
} from "@/features/game/dnd/game-dnd-ids";
import { useDeclareDragPreviewHand } from "@/features/game/dnd/declare-drag-preview-hand-context";
import { cn } from "@/lib/utils";
import { useIsLandscapeMobile } from "@/hooks/use-mobile";
import {
  PLAYER_HAND_FAN_LOOSE_OVERLAP_PX,
  PLAYER_HAND_FAN_MAX_OVERLAP_PX,
  PLAYER_HAND_FAN_MIN_VISIBLE_PX,
  PLAYER_HAND_FAN_ROTATION_MAX_DEG,
  PLAYER_HAND_FAN_ROTATION_NUMERATOR,
  PLAYER_HAND_DRAGGING_Z_INDEX,
  PLAYER_HAND_HOVER_Z_INDEX_BOOST,
  PLAYER_HAND_SELECTED_Z_INDEX,
  PLAYER_HAND_STRIP_MIN_HEIGHT_CLASS,
  handCardWidthFromStripPx,
} from "@/lib/game-room.constants";

export type PlayerHandDrawPassDropConfig = {
  active: boolean;
  pileDragActive: boolean;
};

export function fanWidthPx(cardCount: number, cardWidthPx: number, overlapPx: number): number {
  if (cardCount <= 0) return 0;
  if (cardCount === 1) return cardWidthPx;
  return cardCount * cardWidthPx - (cardCount - 1) * overlapPx;
}

export function computeFanOverlapPx(
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

type PlayerHandCardStripItemProps = {
  card: GameCard;
  index: number;
  overlapPx: number;
  reduced: boolean;
  disabled: boolean;
  selected: boolean;
  rotate: number;
  onInspectCard: (card: GameCard) => void;
  drawPassDrop: PlayerHandDrawPassDropConfig | null;
  skipNextClickRef: MutableRefObject<boolean>;
  registerCardEl: (cardId: string, el: HTMLDivElement | null) => void;
  handCardWidthPx: number;
};

const PlayerHandCardStripItem = memo(function PlayerHandCardStripItem({
  card,
  index,
  overlapPx,
  reduced,
  disabled,
  selected,
  rotate,
  onInspectCard,
  drawPassDrop,
  skipNextClickRef,
  registerCardEl,
  handCardWidthPx,
}: PlayerHandCardStripItemProps) {
  const { active } = useDndContext();
  const declarePreviewHand = useDeclareDragPreviewHand();
  const declareDragUsesOverlay = declarePreviewHand.length > 0;
  const allowDrag = !disabled;
  const dragData = useMemo(
    () => ({ kind: GAME_DND_KIND.DECLARE_CARD, cardId: card.id }) as const,
    [card.id],
  );

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: gameDndDeclareCardDragId(card.id),
    disabled: !allowDrag,
    data: dragData,
  });

  const drawPassBlocksPointer =
    drawPassDrop?.active === true &&
    drawPassDrop.pileDragActive &&
    active != null &&
    isGameDndDrawPassData(active.data.current);

  const [hovered, setHovered] = useState(false);
  const isBeingHoveredState = !disabled && !isDragging && hovered;

  const zIndexResolved = isDragging
    ? PLAYER_HAND_DRAGGING_Z_INDEX
    : selected
      ? PLAYER_HAND_SELECTED_Z_INDEX
      : isBeingHoveredState
        ? index + PLAYER_HAND_HOVER_Z_INDEX_BOOST
        : index;

  const hideSourceForDeclareOverlay = isDragging && declareDragUsesOverlay;
  const translateStyle =
    transform && !hideSourceForDeclareOverlay
      ? { transform: CSS.Translate.toString(transform) }
      : undefined;

  const setCardStripRef = useCallback(
    (node: HTMLDivElement | null) => {
      setNodeRef(node);
      registerCardEl(card.id, node);
    },
    [card.id, registerCardEl, setNodeRef],
  );

  return (
    <div
      ref={setCardStripRef}
      className={cn(
        "origin-bottom shrink-0 snap-center",
        allowDrag && "touch-none",
        isDragging && "cursor-grabbing",
        allowDrag && !isDragging && "cursor-grab",
        drawPassBlocksPointer && "pointer-events-none",
        hideSourceForDeclareOverlay && "pointer-events-none",
      )}
      style={{
        marginLeft: index === 0 ? 0 : -overlapPx,
        zIndex: zIndexResolved,
        ...translateStyle,
        ...(hideSourceForDeclareOverlay ? { opacity: 0 } : {}),
      }}
      {...listeners}
      {...attributes}
      role="listitem"
    >
      <motion.div
        className="origin-bottom"
        style={{ rotate }}
        variants={staggerHandItemVariantsForIndex(index, Boolean(reduced))}
        initial="initial"
        animate={
          isDragging ? "dragging" : isBeingHoveredState ? "hovered" : "animate"
        }
        exit={{ opacity: 0, y: 28, scale: 0.92 }}
        whileHover={!disabled && !isDragging ? "hovered" : undefined}
      >
        <SpiceCard
          card={card}
          size="hand"
          handCardWidthPx={handCardWidthPx}
          selected={selected}
          isHovered={isBeingHoveredState}
          isDragging={isDragging}
          onMouseEnter={() => {
            if (!disabled) setHovered(true);
          }}
          onMouseLeave={() => setHovered(false)}
          onTouchStart={() => {
            if (!disabled) setHovered(true);
          }}
          onTouchEnd={() => setHovered(false)}
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
    </div>
  );
});

interface PlayerHandProps {
  cards: GameCard[];
  selectedCardId: string | null;
  /** Tap / click — inspect card (detail dialog); does not auto-open declare. */
  onInspectCard: (card: GameCard) => void;
  disabled?: boolean;
  /** Drag draw pile onto the hand strip (draw + pass). */
  drawPassDrop?: PlayerHandDrawPassDropConfig | null;
}

export const PlayerHand = memo(function PlayerHand({
  cards,
  selectedCardId,
  onInspectCard,
  disabled,
  drawPassDrop = null,
}: PlayerHandProps) {
  const { t } = useTranslation("game");
  const reduced = useReducedMotion();
  const isLandscapeMobile = useIsLandscapeMobile();
  const skipNextClickRef = useRef(false);
  const prevHandKeyRef = useRef<string | null>(null);
  const stripRef = useRef<HTMLDivElement | null>(null);
  const cardElRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [stripWidth, setStripWidth] = useState(0);
  const handKey = useMemo(() => cards.map((c) => c.id).join("|"), [cards]);

  useDndMonitor({
    onDragEnd(event) {
      if (isGameDndDeclareCardData(event.active.data.current)) {
        skipNextClickRef.current = true;
        window.setTimeout(() => {
          skipNextClickRef.current = false;
        }, 0);
      }
    },
  });

  const { setNodeRef: setHandDrawPassDropRef, isOver: handDrawPassDndOver } = useDroppable({
    id: GAME_DND_DROP_HAND_DRAW_PASS,
    disabled: drawPassDrop?.active !== true,
  });

  const mergeStripRef = useCallback(
    (node: HTMLDivElement | null) => {
      stripRef.current = node;
      setHandDrawPassDropRef(node);
    },
    [setHandDrawPassDropRef],
  );

  const registerCardEl = useCallback((cardId: string, el: HTMLDivElement | null) => {
    if (el) cardElRefs.current.set(cardId, el);
    else cardElRefs.current.delete(cardId);
  }, []);

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

  const cardWidthPx = useMemo(() => handCardWidthFromStripPx(stripWidth), [stripWidth]);
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

  const drawPassHighlightActive =
    drawPassDrop?.active === true &&
    drawPassDrop.pileDragActive &&
    handDrawPassDndOver;

  return (
    <div className="relative w-full min-w-0">
      <div className="relative w-full min-w-0" style={{ perspective: "1400px" }}>
        <div
          ref={mergeStripRef}
          className={cn(
            "relative z-[1] flex w-full min-w-0 items-end justify-center overflow-x-auto overscroll-x-contain px-4 pb-4 pt-6 sm:px-8 sm:pb-5 sm:pt-7",
            PLAYER_HAND_STRIP_MIN_HEIGHT_CLASS,
            isLandscapeMobile && "landscape-compact-hand pt-2 pb-2 sm:pt-2 sm:pb-2",
            "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            "snap-x snap-mandatory md:snap-none",
            isLandscapeMobile && "!snap-x !snap-mandatory",
            drawPassDrop?.active === true &&
              drawPassDrop.pileDragActive &&
              cn(
                "transition-[box-shadow,background-color,transform] duration-200",
                "ring-2 ring-primary/25 ring-offset-2 ring-offset-background",
                drawPassHighlightActive &&
                  "scale-[1.01] bg-primary/[0.08] ring-[3px] ring-primary/70 shadow-[0_0_0_1px_hsl(var(--primary)/0.25)]",
              ),
          )}
          role="list"
          aria-label={
            drawPassDrop?.active === true && drawPassDrop.pileDragActive
              ? t("table.drawPileHandDropZoneAria")
              : t("hand.playerHandAria")
          }
        >
          <div className="flex w-max max-w-full items-end justify-center px-6 md:max-w-none sm:px-10">
            <AnimatePresence mode="popLayout">
            {cards.map((card, index) => {
              const selected = selectedCardId === card.id;
              const rotate = rotations[index] ?? 0;

              return (
                <PlayerHandCardStripItem
                  key={card.id}
                  card={card}
                  index={index}
                  overlapPx={overlapPx}
                  reduced={Boolean(reduced)}
                  disabled={Boolean(disabled)}
                  selected={selected}
                  rotate={rotate}
                  onInspectCard={onInspectCard}
                  drawPassDrop={drawPassDrop}
                  skipNextClickRef={skipNextClickRef}
                  registerCardEl={registerCardEl}
                  handCardWidthPx={cardWidthPx}
                />
              );
            })}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
});
