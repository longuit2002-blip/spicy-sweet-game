"use client";

import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { GameCard } from "@/shared/types/game";
import { CardBackSurface } from "@/features/game/components/CardBackSurface";
import { SpiceCard } from "@/features/game/components/SpiceCard";
import { playRevealCardFlipSound } from "@/features/game/lib/game-reveal-sounds";
import { cn } from "@/lib/utils";

/** Duration of reveal flip from card back to real face (seconds). */
export const PLAYFIELD_REVEAL_FLIP_DURATION_SECONDS = 0.95;

const PLAYFIELD_FLIP_EASE = [0.22, 1, 0.36, 1] as const;

export type PlayfieldDeclaredCardFlipProps = {
  /** Real played card — only rendered on the front face when {@link showFaceUp} is true. */
  faceCard: GameCard | null;
  /** True in `REVEAL` when `faceCard` is known — runs back → face flip. Until then, only card back is shown. */
  showFaceUp: boolean;
  ariaLabel: string;
  className?: string;
};

export function PlayfieldDeclaredCardFlip({
  faceCard,
  showFaceUp,
  ariaLabel,
  className,
}: PlayfieldDeclaredCardFlipProps) {
  const reducedMotion = useReducedMotion() === true;
  const flipArmedRef = useRef(false);

  const faceReady = !!(showFaceUp && faceCard != null);
  useEffect(() => {
    if (reducedMotion) {
      flipArmedRef.current = faceReady;
      return;
    }
    if (faceReady && !flipArmedRef.current) {
      void playRevealCardFlipSound();
    }
    flipArmedRef.current = faceReady;
  }, [faceReady, reducedMotion]);

  return (
    <div
      className={cn(
        "relative h-full min-h-0 w-full min-w-0 [perspective:1400px]",
        className,
      )}
      role="img"
      aria-label={ariaLabel}
    >
      <motion.div
        className="absolute inset-0 [transform-style:preserve-3d]"
        initial={{ rotateY: 0 }}
        animate={{ rotateY: showFaceUp && faceCard != null ? 180 : 0 }}
        transition={
          reducedMotion
            ? { duration: 0 }
            : showFaceUp && faceCard != null
              ? {
                  duration: PLAYFIELD_REVEAL_FLIP_DURATION_SECONDS,
                  ease: PLAYFIELD_FLIP_EASE,
                }
              : { duration: 0 }
        }
        style={{ transformOrigin: "center center" }}
      >
        <div
          className="absolute inset-0 [backface-visibility:hidden]"
          style={{ transform: "rotateY(0deg)" }}
        >
          <CardBackSurface corner="lg" framed={false} className="h-full w-full" />
        </div>
        <div
          className="absolute inset-0 flex items-center justify-center [backface-visibility:hidden]"
          style={{ transform: "rotateY(180deg)" }}
        >
          {showFaceUp && faceCard != null ? (
            <div className="flex h-full w-full items-center justify-center">
              <SpiceCard card={faceCard} faceDown={false} size="hand" artOnly />
            </div>
          ) : (
            <div className="h-full w-full rounded-md bg-card-back/25" aria-hidden />
          )}
        </div>
      </motion.div>
    </div>
  );
}
