"use client";

import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { GameCard } from "@/shared/types/game";
import { CardBackSurface } from "@/features/game/components/CardBackSurface";
import { SpiceCard } from "@/features/game/components/SpiceCard";
import { playRevealCardFlipSound } from "@/features/game/lib/game-reveal-sounds";
import { cn } from "@/lib/utils";

/** Duration of reveal flip from card back to real face (seconds), after optional delay. */
export const PLAYFIELD_REVEAL_FLIP_DURATION_SECONDS = 3;

/** Optional extra pause before rotation (REVEAL “lock” uses server timer instead; default 0). */
export const PLAYFIELD_REVEAL_FLIP_DELAY_SECONDS = 0;

const PLAYFIELD_FLIP_EASE = [0.22, 1, 0.36, 1] as const;

export type PlayfieldDeclaredCardFlipProps = {
  /** Real played card — only rendered on the front face when {@link showFaceUp} is true. */
  faceCard: GameCard | null;
  /** True in `REVEAL` when `faceCard` is known — runs back → face flip. Until then, only card back is shown. */
  showFaceUp: boolean;
  ariaLabel: string;
  className?: string;
  /** Seconds to wait before the 3D flip begins (ignored when reduced motion is on). */
  flipDelaySeconds?: number;
};

export function PlayfieldDeclaredCardFlip({
  faceCard,
  showFaceUp,
  ariaLabel,
  className,
  flipDelaySeconds = PLAYFIELD_REVEAL_FLIP_DELAY_SECONDS,
}: PlayfieldDeclaredCardFlipProps) {
  const reducedMotion = useReducedMotion() === true;
  const flipArmedRef = useRef(false);
  const soundTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const faceReady = !!(showFaceUp && faceCard != null);
  const effectiveDelay = reducedMotion ? 0 : flipDelaySeconds;

  useEffect(() => {
    if (reducedMotion) {
      if (soundTimeoutRef.current != null) {
        clearTimeout(soundTimeoutRef.current);
        soundTimeoutRef.current = null;
      }
      if (faceReady && !flipArmedRef.current) {
        void playRevealCardFlipSound();
      }
      flipArmedRef.current = faceReady;
      return;
    }
    if (faceReady && !flipArmedRef.current) {
      if (soundTimeoutRef.current != null) {
        clearTimeout(soundTimeoutRef.current);
      }
      const delayMs = Math.round(effectiveDelay * 1000);
      soundTimeoutRef.current = setTimeout(() => {
        soundTimeoutRef.current = null;
        void playRevealCardFlipSound();
      }, delayMs);
    }
    if (!faceReady && soundTimeoutRef.current != null) {
      clearTimeout(soundTimeoutRef.current);
      soundTimeoutRef.current = null;
    }
    flipArmedRef.current = faceReady;
    return () => {
      if (soundTimeoutRef.current != null) {
        clearTimeout(soundTimeoutRef.current);
        soundTimeoutRef.current = null;
      }
    };
  }, [faceReady, reducedMotion, effectiveDelay]);

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
                  delay: effectiveDelay,
                  duration: PLAYFIELD_REVEAL_FLIP_DURATION_SECONDS,
                  ease: PLAYFIELD_FLIP_EASE,
                }
              : { duration: 0 }
        }
        style={{ transformOrigin: "center center" }}
      >
        <motion.div
          className="absolute inset-0 [backface-visibility:hidden]"
          style={{ transform: "rotateY(0deg)" }}
          animate={
            reducedMotion
              ? { scale: 1, filter: "brightness(1)" }
              : showFaceUp && faceCard != null
                ? {
                    scale: [1, 1.03, 1, 1.015, 1],
                    filter: [
                      "brightness(1)",
                      "brightness(1.12)",
                      "brightness(1.04)",
                      "brightness(1.08)",
                      "brightness(1)",
                    ],
                  }
                : { scale: 1, filter: "brightness(1)" }
          }
          transition={
            reducedMotion
              ? { duration: 0 }
              : showFaceUp && faceCard != null
                ? {
                    duration: Math.min(0.9, flipDelaySeconds + 0.35),
                    times: [0, 0.25, 0.5, 0.78, 1],
                    ease: "easeInOut",
                  }
                : { duration: 0.2 }
          }
        >
          <CardBackSurface corner="lg" framed={false} className="h-full w-full" />
        </motion.div>
        <div
          className="absolute inset-0 [backface-visibility:hidden]"
          style={{ transform: "rotateY(180deg)" }}
        >
          {showFaceUp && faceCard != null ? (
            <SpiceCard card={faceCard} faceDown={false} size="playfield" artOnly />
          ) : (
            <div className="h-full w-full rounded-md bg-card-back/25" aria-hidden />
          )}
        </div>
      </motion.div>
    </div>
  );
}
