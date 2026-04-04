import { motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import {
  memo,
  type DragEventHandler,
  type MouseEventHandler,
  type TouchEventHandler,
} from "react";
import type { GameCard } from "@/shared/types/game";
import { CardBackSurface } from "@/features/game/components/CardBackSurface";
import { cn } from "@/lib/utils";
import {
  FLOAT_SPRING,
  HAND_SELECTION_GLOW,
  TAP_FEEDBACK_TRANSITION,
} from "@/features/game/animations";
import {
  GAME_CARD_ART_ASPECT_CLASS,
  GAME_CARD_NEXT_IMAGE_QUALITY,
  getGameCardFrontSrc,
  SPICE_CARD_BORDER_CLASS,
} from "@/lib/game-card-assets";
import {
  SPICE_CARD_DUEL_WIDTH_CLASS,
  SPICE_CARD_HAND_FALLBACK_WIDTH_CLASS,
  SPICE_CARD_TABLEAU_WIDTH_CLASS,
} from "@/lib/game-room.constants";

/**
 * `hand` — local fan; `tableau` — supply rail; `duel` — larger duel-board trophy column; `playfield` — REVEAL flip slot.
 */
export type SpiceCardSize = "default" | "small" | "hand" | "tableau" | "duel" | "playfield";

/** Single chrome set for in-hand cards — nhẹ: bo góc + viền token, art vẫn full-bleed trong khung. */
const HAND_SURFACE_CLASS =
  "rounded-sm border border-border/35 bg-transparent shadow-md sm:shadow-lg sm:rounded-md";

/** Hand: ring only; outer glow comes from {@link HAND_SELECTION_GLOW} on `motion.div`. */
const HAND_RING_SELECTED_RING_ONLY_CLASS =
  "z-10 ring-2 ring-primary ring-offset-0";

const HAND_RING_IDLE_HOVER_CLASS =
  "ring-2 ring-transparent ring-offset-0 hover:ring-primary/45 motion-safe:transition-[transform,box-shadow] motion-safe:duration-200";

interface SpiceCardProps {
  card: GameCard;
  faceDown?: boolean;
  selected?: boolean;
  onClick?: () => void;
  small?: boolean;
  /** Overrides `small` when set (except `small` still wins for face-down compact). */
  size?: SpiceCardSize;
  /** HTML5 drag — parent should set `application/x-sweet-spicy-card-id` in `onDragStart`. */
  draggable?: boolean;
  onDragStart?: DragEventHandler<HTMLDivElement>;
  onDragEnd?: DragEventHandler<HTMLDivElement>;
  /** Hand strip drives lift so overlap + z-index stay consistent (v0-style). */
  isHovered?: boolean;
  isDragging?: boolean;
  /** When `size="hand"`, fixes pixel width to match {@link PlayerHand} fan overlap math. */
  handCardWidthPx?: number;
  onMouseEnter?: MouseEventHandler<HTMLDivElement>;
  onMouseLeave?: MouseEventHandler<HTMLDivElement>;
  onTouchStart?: TouchEventHandler<HTMLDivElement>;
  onTouchEnd?: TouchEventHandler<HTMLDivElement>;
  /**
   * Face-up only: no border / spice wash — full-bleed art (e.g. playfield reveal flip).
   */
  artOnly?: boolean;
}

function sizeClasses(
  size: SpiceCardSize,
  smallLegacy: boolean | undefined,
  handCardWidthPx: number | undefined,
): {
  box: string;
  text: string;
  imageSizes: string;
} {
  if (smallLegacy) {
    return {
      box: cn("w-14", GAME_CARD_ART_ASPECT_CLASS),
      text: "text-xs",
      imageSizes: "(max-width: 640px) 56px, 84px",
    };
  }
  if (size === "hand") {
    if (handCardWidthPx != null) {
      const compactText = handCardWidthPx < 100;
      return {
        box: cn("min-w-0 shrink-0", GAME_CARD_ART_ASPECT_CLASS),
        text: compactText ? "text-xs" : "text-sm",
        imageSizes: `${Math.round(handCardWidthPx)}px`,
      };
    }
    return {
      box: cn(SPICE_CARD_HAND_FALLBACK_WIDTH_CLASS, GAME_CARD_ART_ASPECT_CLASS),
      text: "text-sm sm:text-base",
      imageSizes: "(max-width: 419px) 84px, (max-width: 639px) 92px, (max-width: 767px) 120px, 136px",
    };
  }
  if (size === "tableau") {
    return {
      box: cn(SPICE_CARD_TABLEAU_WIDTH_CLASS, GAME_CARD_ART_ASPECT_CLASS),
      text: "text-xs",
      imageSizes: "(max-width: 419px) 88px, (max-width: 639px) 100px, (max-width: 767px) 116px, 128px",
    };
  }
  if (size === "duel") {
    return {
      box: cn(SPICE_CARD_DUEL_WIDTH_CLASS, GAME_CARD_ART_ASPECT_CLASS),
      text: "text-xs sm:text-sm",
      imageSizes: "(max-width: 419px) 68px, (max-width: 639px) 84px, (max-width: 767px) 92px, (max-width: 1023px) 108px, (max-width: 1535px) 120px, 132px",
    };
  }
  if (size === "playfield") {
    return {
      box: "h-full w-full min-h-0",
      text: "text-xs sm:text-sm",
      imageSizes: "(max-width: 640px) 80vw, (max-width: 1024px) 200px, (max-width: 1536px) 240px, 280px",
    };
  }
  return {
    box: cn("w-20 sm:w-24", GAME_CARD_ART_ASPECT_CLASS),
    text: "text-sm sm:text-base",
    imageSizes: "(max-width: 640px) 80px, 96px",
  };
}

export const SpiceCard = memo(function SpiceCard({
  card,
  faceDown,
  selected,
  onClick,
  small,
  size: sizeProp = "default",
  draggable = false,
  onDragStart,
  onDragEnd,
  isHovered = false,
  isDragging = false,
  onMouseEnter,
  onMouseLeave,
  onTouchStart,
  onTouchEnd,
  artOnly = false,
  handCardWidthPx,
}: SpiceCardProps) {
  const reduced = useReducedMotion();
  const { box: sizeBox, text: sizeText, imageSizes } = sizeClasses(
    small ? "small" : sizeProp,
    small,
    handCardWidthPx,
  );
  const size = cn(sizeBox, sizeText);
  const handWidthStyle =
    handCardWidthPx != null && sizeProp === "hand" && !small ? { width: handCardWidthPx } : undefined;

  if (faceDown) {
    const backCorner =
      small ? "default" : sizeProp === "hand" ? "square" : "lg";
    return (
      <motion.div
        whileHover={onClick && !reduced ? { y: -4 } : undefined}
        whileTap={onClick ? { scale: 0.95, transition: TAP_FEEDBACK_TRANSITION } : undefined}
        transition={FLOAT_SPRING}
        onClick={onClick}
        style={handWidthStyle}
        className={cn(size, "cursor-default select-none overflow-hidden rounded-sm sm:rounded-md")}
      >
        <CardBackSurface corner={backCorner} className="h-full w-full" />
      </motion.div>
    );
  }

  const wild =
    card.kind === "wild-suit" ||
    card.kind === "wild-number" ||
    card.kind === "total-wild";
  const frontSrc = getGameCardFrontSrc(card);
  const borderClass =
    card.kind === "trophy" ? "border-trophy-gold/80" : SPICE_CARD_BORDER_CLASS[card.type];

  const isHandSize = !small && sizeProp === "hand";
  const tableSurfaceClass = cn(
    "rounded-sm border-2 sm:rounded-md",
    borderClass,
    "shadow-card",
  );
  const artOnlySurfaceClass = "relative h-full w-full overflow-hidden rounded-md sm:rounded-md";

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      style={handWidthStyle}
      className={cn(
        sizeBox,
        "origin-bottom select-none",
        onClick && "cursor-pointer",
        draggable && "cursor-grab active:cursor-grabbing",
        !onClick && !draggable && "cursor-default",
      )}
    >
      <motion.div
        layout={!isHandSize}
        transition={FLOAT_SPRING}
        variants={isHandSize ? HAND_SELECTION_GLOW : undefined}
        initial={isHandSize ? (selected ? "selected" : "unselected") : false}
        animate={isHandSize ? (selected ? "selected" : "unselected") : undefined}
        className={cn(
          artOnly ? artOnlySurfaceClass : "relative h-full w-full overflow-hidden",
          !artOnly && (isHandSize ? HAND_SURFACE_CLASS : tableSurfaceClass),
          sizeText,
          selected &&
            !artOnly &&
            (isHandSize
              ? HAND_RING_SELECTED_RING_ONLY_CLASS
              : "z-10 shadow-kawaii ring-2 ring-primary ring-offset-2 ring-offset-background"),
          card.kind !== "normal" && !isHandSize && !artOnly && "ring-1 ring-trophy-gold/50",
          onClick &&
            !selected &&
            !artOnly &&
            (isHandSize
              ? HAND_RING_IDLE_HOVER_CLASS
              : "ring-2 ring-transparent ring-offset-2 ring-offset-background hover:ring-primary/45 motion-safe:transition-[transform,box-shadow] motion-safe:duration-200"),
          isHandSize &&
            draggable &&
            isHovered &&
            !isDragging &&
            !reduced &&
            "brightness-110",
          isHandSize && isDragging && !reduced && "brightness-125",
        )}
        style={{ transformOrigin: "50% 100%" }}
        whileHover={
          onClick && !reduced && !isHandSize
            ? {
                y: -10,
                rotate: -2,
                scale: 1.04,
                boxShadow: "0 14px 32px -12px hsl(0 0% 0% / 0.22)",
                transition: { type: "spring", stiffness: 380, damping: 28 },
              }
            : undefined
        }
        whileTap={onClick ? { scale: 0.97, transition: TAP_FEEDBACK_TRANSITION } : undefined}
        onClick={onClick}
      >
        <Image
          src={frontSrc}
          alt=""
          fill
          quality={GAME_CARD_NEXT_IMAGE_QUALITY}
          className="pointer-events-none object-cover"
          sizes={imageSizes}
        />
        {/* Hand fan: no shimmer so wilds match normal cards visually; tableau keeps shimmer. */}
        {wild && !isHandSize && !artOnly ? (
          <span className="wild-shimmer-overlay" aria-hidden />
        ) : null}
      </motion.div>
    </div>
  );
});
