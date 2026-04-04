"use client";

import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { GamePlayer, ClientGamePlayer } from "@/shared/types/game";
import type { GamePhase } from "@/shared/types/game";
import { GAME_PHASE } from "@/shared/types/game";
import { cn } from "@/lib/utils";
import {
  OPPONENT_CAROUSEL_ARC_ROTATE_DEG_PER_STEP,
  OPPONENT_CAROUSEL_CELL_MIN_WIDTH_CLASS,
  OPPONENT_CAROUSEL_FOCUS_TRANSLATE_Z_PX,
  OPPONENT_CAROUSEL_SCALE_CENTER,
  OPPONENT_CAROUSEL_SCALE_FAR,
  OPPONENT_CAROUSEL_SCALE_SIDE,
} from "@/lib/game-room.constants";
import { STAGGER_CONTAINER_DELAY_CHILDREN_SECONDS } from "@/features/game/animations";
import { OpponentSeatBubble } from "./OpponentSeatBubble";
import { useIsMobile } from "@/hooks/use-mobile";

type BoardPlayer = GamePlayer | ClientGamePlayer;

export type OpponentCarouselSlot = {
  player: BoardPlayer;
  turnRelative: number;
};

type OpponentsTurnCarouselProps = {
  slots: readonly OpponentCarouselSlot[];
  currentPlayer: BoardPlayer | undefined;
  currentPlayerIndex: number;
  phase: GamePhase;
  reducedMotion: boolean;
};

function scaleForCarouselDistance(distance: number): number {
  if (distance <= 0) return OPPONENT_CAROUSEL_SCALE_CENTER;
  if (distance === 1) return OPPONENT_CAROUSEL_SCALE_SIDE;
  return OPPONENT_CAROUSEL_SCALE_FAR;
}

function opacityForCarouselDistance(distance: number): number {
  if (distance <= 0) return 1;
  if (distance === 1) return 0.88;
  return 0.7;
}

function anchorListIndex(slots: readonly OpponentCarouselSlot[], currentPlayer: BoardPlayer | undefined): number {
  if (slots.length === 0) return 0;
  const activeIdx = currentPlayer ? slots.findIndex((s) => s.player.id === currentPlayer.id) : -1;
  if (activeIdx >= 0) return activeIdx;
  const nextIdx = slots.findIndex((s) => s.turnRelative === 1);
  if (nextIdx >= 0) return nextIdx;
  return 0;
}

const OPPONENT_ROW_STAGGER_FACTOR = 0.9;

export function OpponentsTurnCarousel({
  slots,
  currentPlayer,
  currentPlayerIndex,
  phase,
  reducedMotion,
}: OpponentsTurnCarouselProps) {
  const { t } = useTranslation("game");
  const isMobile = useIsMobile();
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  /** Disable 3D parallax on mobile to reduce GPU load. */
  const disable3d = reducedMotion || isMobile;

  const focusIx = useMemo(() => anchorListIndex(slots, currentPlayer), [slots, currentPlayer]);

  const scrollFocusedIntoCenter = useCallback(() => {
    const focused = slots[focusIx];
    if (!focused) return;
    const el = itemRefs.current.get(focused.player.id);
    if (!el) return;
    el.scrollIntoView({
      inline: "center",
      block: "nearest",
      behavior: reducedMotion ? "auto" : "smooth",
    });
  }, [slots, focusIx, reducedMotion]);

  useLayoutEffect(() => {
    scrollFocusedIntoCenter();
  }, [scrollFocusedIntoCenter, currentPlayerIndex, phase, focusIx]);

  if (slots.length === 0) return null;

  return (
    <div role="region" aria-label={t("room.opponentsTurnCarousel")} className="relative w-full shrink-0">
      <div
        className="pointer-events-none absolute inset-0 -z-[1] bg-[radial-gradient(ellipse_125%_100%_at_50%_70%,hsl(var(--primary)/0.14)_0%,transparent_55%,hsl(var(--background))_100%)]"
        aria-hidden
      />
      <div
        role="list"
        className={cn(
          "relative flex min-w-0 w-full snap-x snap-mandatory overflow-x-auto overflow-y-visible scroll-smooth",
          "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          "gap-3 px-1 py-3 sm:gap-4 sm:px-2 sm:py-4",
          /** Few opponents: center the row on the mat; many: stay scroll-safe (no clipped snap). */
          "[justify-content:safe_center]",
          !disable3d && "[perspective:1100px] [perspective-origin:50%_85%]",
        )}
        style={!disable3d ? { transformStyle: "preserve-3d" } : undefined}
      >
        {slots.map((slot, listIndex) => {
          const isCurrentTurn = currentPlayer?.id === slot.player.id;
          const isUpNext = slot.turnRelative === 1 && !isCurrentTurn;
          const dist = Math.abs(listIndex - focusIx);
          const carouselScale = scaleForCarouselDistance(dist);
          const carouselOpacity = opacityForCarouselDistance(dist);
          const isIncomingTurnEmphasis = phase === GAME_PHASE.NEXT_TURN && isCurrentTurn;
          const rowStaggerDelay = listIndex * STAGGER_CONTAINER_DELAY_CHILDREN_SECONDS * OPPONENT_ROW_STAGGER_FACTOR;
          const isCarouselFocus = dist === 0;
          const arcDeg = (listIndex - focusIx) * -OPPONENT_CAROUSEL_ARC_ROTATE_DEG_PER_STEP;
          const translateZ = isCarouselFocus ? OPPONENT_CAROUSEL_FOCUS_TRANSLATE_Z_PX : 0;

          return (
            <div
              key={slot.player.id}
              role="listitem"
              ref={(node) => {
                if (node) itemRefs.current.set(slot.player.id, node);
                else itemRefs.current.delete(slot.player.id);
              }}
              className={cn(
                "flex snap-center shrink-0 flex-col items-center justify-end",
                OPPONENT_CAROUSEL_CELL_MIN_WIDTH_CLASS,
              )}
            >
              <div
                className={cn(
                  "flex min-h-0 w-full flex-col items-center justify-end origin-bottom",
                  !disable3d && "transition-[transform,filter] duration-300 ease-out will-change-transform",
                )}
                style={
                  disable3d
                    ? undefined
                    : {
                        transform: `rotateY(${arcDeg}deg) translateZ(${translateZ}px)`,
                        transformStyle: "preserve-3d",
                      }
                }
              >
                <OpponentSeatBubble
                  opp={slot.player}
                  isCurrentTurn={isCurrentTurn}
                  turnRelative={slot.turnRelative}
                  phase={phase}
                  isUpNext={isUpNext}
                  reducedMotion={reducedMotion}
                  carouselScale={carouselScale}
                  carouselOpacity={carouselOpacity}
                  isIncomingTurnEmphasis={isIncomingTurnEmphasis}
                  rowStaggerDelay={rowStaggerDelay}
                  isCarouselFocus={isCarouselFocus}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
