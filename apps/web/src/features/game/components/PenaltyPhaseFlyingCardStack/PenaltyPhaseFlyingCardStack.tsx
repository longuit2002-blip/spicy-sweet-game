"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  PENALTY_PILE_DRAW_FLIGHT_INITIAL_SCALE,
  PENALTY_PILE_DRAW_FLIGHT_INITIAL_X_PX,
  PENALTY_PILE_DRAW_FLIGHT_INITIAL_Y_PX,
  PENALTY_PILE_DRAW_FLIGHT_STAGGER_SECONDS,
  PHASE_TRANSITION_REDUCED,
  SNAPPY_SPRING,
} from "@/features/game/animations";
import {
  PENALTY_PHASE_PILE_COMPACT_FLIGHT_RATIO,
  PENALTY_PHASE_PILE_COMPACT_OVERLAP_RATIO,
  PENALTY_PHASE_PILE_DISPLAY_MAX,
  PENALTY_PHASE_PILE_OVERLAP_PX,
} from "@/lib/game-room.constants";
import { cn } from "@/lib/utils";

/** Panel preview: min width so a single face-down card does not read as a thin vertical bar. */
const PENALTY_STACK_PANEL_CARD_WIDTH_CLASS =
  "min-w-[2.75rem] w-12 sm:min-w-[3.25rem] sm:w-14";

export type PenaltyPhaseStackDensity = "strip" | "panel";

export type PenaltyPhaseFlyingCardStackProps = {
  pileCardCount: number;
  className?: string;
  /** Narrower cards + less vertical padding (PENALTY strip under copy). */
  compact?: boolean;
  /**
   * `panel` — round-end preview: wider cards + full overlap so low `pileCardCount` still scans as a stack.
   * When set, overrides {@link compact} sizing/overlap/flight offsets.
   */
  density?: PenaltyPhaseStackDensity;
};

/**
 * Face-down penalty cards with staggered motion from the draw-pile side (duel rail).
 */
export function PenaltyPhaseFlyingCardStack({
  pileCardCount,
  className,
  compact = false,
  density = "strip",
}: PenaltyPhaseFlyingCardStackProps) {
  const reducedMotion = useReducedMotion() === true;
  const n = Math.min(Math.max(pileCardCount, 1), PENALTY_PHASE_PILE_DISPLAY_MAX);
  const isPanel = density === "panel";
  const useCompactSizing = compact && !isPanel;
  const overlapPx = useCompactSizing
    ? Math.round(PENALTY_PHASE_PILE_OVERLAP_PX * PENALTY_PHASE_PILE_COMPACT_OVERLAP_RATIO)
    : PENALTY_PHASE_PILE_OVERLAP_PX;
  const initialX = useCompactSizing
    ? Math.round(PENALTY_PILE_DRAW_FLIGHT_INITIAL_X_PX * PENALTY_PHASE_PILE_COMPACT_FLIGHT_RATIO)
    : PENALTY_PILE_DRAW_FLIGHT_INITIAL_X_PX;
  const initialY = useCompactSizing
    ? Math.round(PENALTY_PILE_DRAW_FLIGHT_INITIAL_Y_PX * PENALTY_PHASE_PILE_COMPACT_FLIGHT_RATIO)
    : PENALTY_PILE_DRAW_FLIGHT_INITIAL_Y_PX;

  return (
    <div
      className={cn(
        "flex max-w-full min-w-0 shrink-0 flex-nowrap justify-center overflow-x-auto overflow-y-visible pb-1 pt-0.5 [scrollbar-width:thin]",
        useCompactSizing ? "px-2 py-0" : "px-2 py-1",
        className,
      )}
      aria-hidden
    >
      {Array.from({ length: n }).map((_, i) => (
        <motion.div
          key={i}
          initial={
            reducedMotion
              ? { opacity: 0 }
              : {
                  x: initialX,
                  y: initialY,
                  scale: PENALTY_PILE_DRAW_FLIGHT_INITIAL_SCALE,
                  opacity: 0,
                }
          }
          animate={{ x: 0, y: 0, scale: 1, opacity: 1 }}
          transition={
            reducedMotion
              ? { ...PHASE_TRANSITION_REDUCED, delay: i * PENALTY_PILE_DRAW_FLIGHT_STAGGER_SECONDS }
              : {
                  ...SNAPPY_SPRING,
                  delay: i * PENALTY_PILE_DRAW_FLIGHT_STAGGER_SECONDS,
                }
          }
          className={cn(
            "aspect-[2/3] shrink-0 border border-border/80 bg-card-back shadow-sm",
            isPanel
              ? cn(PENALTY_STACK_PANEL_CARD_WIDTH_CLASS, "rounded-md")
              : useCompactSizing
                ? "w-8 rounded-md sm:w-9"
                : "w-11 rounded-md sm:w-12",
          )}
          style={{
            marginLeft: i === 0 ? 0 : -overlapPx,
          }}
        />
      ))}
    </div>
  );
}
