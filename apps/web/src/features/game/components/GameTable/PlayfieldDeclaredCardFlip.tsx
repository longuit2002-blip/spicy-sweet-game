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
  /** Total Wild resolve: faster flip + trophy glow pulse (everyone sees the real card). */
  supremeImpact?: boolean;
  ariaLabel: string;
  className?: string;
  /** Seconds to wait before the 3D flip begins (ignored when reduced motion is on). */
  flipDelaySeconds?: number;
};

const SUPREME_FLIP_DURATION_SECONDS = 0.55;

export function PlayfieldDeclaredCardFlip({
  faceCard,
  showFaceUp,
  supremeImpact = false,
  ariaLabel,
  className,
  flipDelaySeconds = PLAYFIELD_REVEAL_FLIP_DELAY_SECONDS,
}: PlayfieldDeclaredCardFlipProps) {
  const reducedMotion = useReducedMotion() === true;
  const flipArmedRef = useRef(false);
  const soundTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const faceReady = !!(showFaceUp && faceCard != null);
  const effectiveDelay = reducedMotion || supremeImpact ? 0 : flipDelaySeconds;
  const flipDurationSeconds =
    reducedMotion || !faceReady
      ? 0
      : supremeImpact
        ? SUPREME_FLIP_DURATION_SECONDS
        : PLAYFIELD_REVEAL_FLIP_DURATION_SECONDS;

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
        supremeImpact && "rounded-md",
        className,
      )}
      role="img"
      aria-label={ariaLabel}
    >
      <motion.div
        className={cn(
          "absolute inset-0 [transform-style:preserve-3d]",
          showFaceUp && faceCard != null && !reducedMotion && "will-change-transform",
        )}
        initial={{ rotateY: 0 }}
        animate={{ rotateY: showFaceUp && faceCard != null ? 180 : 0 }}
        transition={
          reducedMotion
            ? { duration: 0 }
            : showFaceUp && faceCard != null
              ? {
                  delay: effectiveDelay,
                  duration: flipDurationSeconds,
                  ease: supremeImpact ? ([0.2, 0.85, 0.24, 1] as const) : PLAYFIELD_FLIP_EASE,
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
                ? supremeImpact
                  ? {
                      scale: [1, 1.06, 1.02, 1],
                      filter: [
                        "brightness(1)",
                        "brightness(1.18)",
                        "brightness(1.08)",
                        "brightness(1)",
                      ],
                    }
                  : {
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
                ? supremeImpact
                  ? { duration: Math.min(0.65, flipDurationSeconds + 0.12), ease: "easeOut" }
                  : {
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
      {supremeImpact && faceCard != null && !reducedMotion ? (
        <motion.div
          className="pointer-events-none absolute inset-0 rounded-md ring-2 ring-trophy-gold/55"
          aria-hidden
          animate={{
            boxShadow: [
              "0 0 0 0px hsl(var(--trophy-glow) / 0)",
              "0 0 28px 4px hsl(var(--trophy-glow) / 0.45)",
              "0 0 0 0px hsl(var(--trophy-glow) / 0)",
            ],
            opacity: [0.75, 1, 0.75],
          }}
          transition={{ duration: 1.35, repeat: Infinity, ease: "easeInOut" }}
        />
      ) : null}
    </div>
  );
}
