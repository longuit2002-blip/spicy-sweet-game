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
  getGameCardFrontSrc,
  SPICE_CARD_BORDER_CLASS,
} from "@/lib/game-card-assets";

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

/** Trophy +10 badge on hand; contrasts on any card art. */
const handOverlayBadgeClass = (extra: string) =>
  cn(
    "pointer-events-none z-[1] rounded bg-foreground/80 px-1 font-bold uppercase tracking-tighter text-background",
    extra,
  );

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
  onMouseEnter?: MouseEventHandler<HTMLDivElement>;
  onMouseLeave?: MouseEventHandler<HTMLDivElement>;
  onTouchStart?: TouchEventHandler<HTMLDivElement>;
  onTouchEnd?: TouchEventHandler<HTMLDivElement>;
  /**
   * Face-up only: no border / spice wash — full-bleed art (e.g. playfield reveal flip).
   */
  artOnly?: boolean;
}

function sizeClasses(size: SpiceCardSize, smallLegacy: boolean | undefined): {
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
    return {
      box: cn("w-[6.5rem] sm:w-[8.5rem]", GAME_CARD_ART_ASPECT_CLASS),
      text: "text-sm sm:text-base",
      imageSizes: "(max-width: 640px) 104px, 136px",
    };
  }
  if (size === "tableau") {
    return {
      box: cn("w-[7.25rem] sm:w-[8rem]", GAME_CARD_ART_ASPECT_CLASS),
      text: "text-xs",
      imageSizes: "(max-width: 640px) 116px, 128px",
    };
  }
  if (size === "duel") {
    return {
      box: cn("w-[8.875rem] sm:w-[10rem]", GAME_CARD_ART_ASPECT_CLASS),
      text: "text-xs sm:text-sm",
      imageSizes: "(max-width: 640px) 142px, 160px",
    };
  }
  if (size === "playfield") {
    return {
      box: "h-full w-full min-h-0",
      text: "text-xs sm:text-sm",
      imageSizes: "(max-width: 640px) 92vw, (max-width: 1024px) 400px, 480px",
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
}: SpiceCardProps) {
  const reduced = useReducedMotion();
  const { box: sizeBox, text: sizeText, imageSizes } = sizeClasses(
    small ? "small" : sizeProp,
    small,
  );
  const size = cn(sizeBox, sizeText);

  if (faceDown) {
    const backCorner =
      small ? "default" : sizeProp === "hand" ? "square" : "lg";
    return (
      <motion.div
        whileHover={onClick && !reduced ? { y: -4 } : undefined}
        whileTap={onClick ? { scale: 0.95, transition: TAP_FEEDBACK_TRANSITION } : undefined}
        transition={FLOAT_SPRING}
        onClick={onClick}
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
    card.kind === "trophy" ? "border-amber-500/80" : SPICE_CARD_BORDER_CLASS[card.type];

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
          card.kind !== "normal" && !isHandSize && !artOnly && "ring-1 ring-amber-400/50",
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
          unoptimized
          className="pointer-events-none object-cover"
          sizes={imageSizes}
        />
        {card.kind === "trophy" ? (
          <span
            className={
              isHandSize
                ? handOverlayBadgeClass(
                    "absolute bottom-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 text-[9px]",
                  )
                : cn(
                    "pointer-events-none absolute bottom-1 left-1/2 z-[1] -translate-x-1/2 rounded bg-background/75 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-800 dark:text-amber-200",
                    small && "px-1 text-[8px]",
                  )
            }
          >
            +10
          </span>
        ) : null}
        {/* Hand fan: no shimmer so wilds match normal cards visually; tableau keeps shimmer. */}
        {wild && !isHandSize && !artOnly ? (
          <span className="wild-shimmer-overlay" aria-hidden />
        ) : null}
      </motion.div>
    </div>
  );
});
