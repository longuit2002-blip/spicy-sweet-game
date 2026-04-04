"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion, type Transition } from "framer-motion";
import { useTranslation } from "react-i18next";
import { GAME_PHASE, type GamePhase } from "@/shared/types/game";
import {
  CHALLENGE_REVEAL_IMPACT_Z,
  NEXT_TURN_IMPACT_HOLD_MS,
} from "@/lib/game-room.constants";
import { PHASE_TRANSITION_REDUCED } from "@/features/game/animations";

const DIM_ENTER: Transition = { duration: 0.2, ease: [0.32, 0.72, 0, 1] };
const DIM_EXIT: Transition = { duration: 0.18, ease: [0.4, 0, 0.2, 1] };
const TITLE_SPRING: Transition = { type: "spring", stiffness: 340, damping: 24 };

const RING_COUNT = 5;
const RING_DELAYS = [0, 0.06, 0.12, 0.18, 0.24] as const;

const SPARKLE_COUNT = 12;

export type NextTurnImpactOverlayProps = {
  phase: GamePhase;
  /** Player whose `PLAYER_TURN` follows this beat (`currentPlayerIndex` during `NEXT_TURN`). */
  nextActorNickname: string;
  nextActorId: string | null;
  localPlayerId: string;
};

/**
 * Full-viewport “turn advance” beat — shockwave + sparkles + duelist name (Yu-Gi-Oh–style stinger).
 * Auto-dismisses after {@link NEXT_TURN_IMPACT_HOLD_MS}.
 */
export function NextTurnImpactOverlay({
  phase,
  nextActorNickname,
  nextActorId,
  localPlayerId,
}: NextTurnImpactOverlayProps) {
  const { t } = useTranslation("game");
  const reducedMotion = useReducedMotion() === true;
  const [mounted, setMounted] = useState(false);
  const [autoDismissed, setAutoDismissed] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const active = phase === GAME_PHASE.NEXT_TURN;

  useEffect(() => {
    if (!active) {
      setAutoDismissed(false);
      return;
    }
    setAutoDismissed(false);
    const id = window.setTimeout(() => setAutoDismissed(true), NEXT_TURN_IMPACT_HOLD_MS);
    return () => window.clearTimeout(id);
  }, [active]);

  const portalVisible = active && !autoDismissed;
  const isLocalNext = nextActorId != null && nextActorId === localPlayerId;

  const sparkleAngles = useMemo(
    () => Array.from({ length: SPARKLE_COUNT }, (_, i) => (i / SPARKLE_COUNT) * Math.PI * 2),
    [],
  );

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {portalVisible ? (
        <motion.div
          key="next-turn-impact"
          className="pointer-events-none fixed inset-0 flex flex-col items-center justify-center overflow-hidden"
          style={{ zIndex: CHALLENGE_REVEAL_IMPACT_Z }}
          initial={reducedMotion ? { opacity: 0 } : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
          transition={reducedMotion ? PHASE_TRANSITION_REDUCED : DIM_ENTER}
          aria-hidden
        >
          <motion.div
            className="absolute inset-0 bg-black/45"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={reducedMotion ? PHASE_TRANSITION_REDUCED : DIM_EXIT}
          />

          <motion.div
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={
              reducedMotion
                ? { opacity: 0.42 }
                : { opacity: [0.35, 0.72, 0.48, 0.65, 0.4] }
            }
            transition={
              reducedMotion
                ? { duration: 0.28 }
                : { duration: 1.65, repeat: Infinity, ease: "easeInOut" }
            }
            style={{
              background:
                "radial-gradient(ellipse 110% 88% at 50% 36%, hsl(var(--primary) / 0.48) 0%, hsl(var(--secondary) / 0.22) 38%, transparent 70%)",
            }}
          />

          {!reducedMotion
            ? RING_DELAYS.slice(0, RING_COUNT).map((delay, i) => (
                <motion.div
                  key={`next-ring-${i}`}
                  className="pointer-events-none absolute left-1/2 top-[38%] h-[min(78vmin,360px)] w-[min(78vmin,360px)] -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-secondary/55 sm:h-[min(88vmin,480px)] sm:w-[min(88vmin,480px)]"
                  initial={{ scale: 0.06, opacity: 0.78 }}
                  animate={{ scale: 1.65, opacity: 0 }}
                  transition={{
                    duration: 0.72,
                    delay,
                    ease: [0.15, 0.92, 0.2, 1],
                  }}
                />
              ))
            : null}

          {!reducedMotion
            ? sparkleAngles.map((angle, i) => (
                <motion.div
                  key={`next-spark-${i}`}
                  className="pointer-events-none absolute left-1/2 top-[38%] h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-secondary shadow-[0_0_14px_hsl(var(--secondary)/0.95)]"
                  initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
                  animate={{
                    opacity: [0, 1, 0.9, 0],
                    scale: [0.2, 1.1, 0.85, 0.15],
                    x: [0, Math.cos(angle) * (92 + (i % 4) * 14)],
                    y: [0, Math.sin(angle) * (70 + (i % 3) * 12)],
                  }}
                  transition={{
                    duration: 0.76,
                    delay: i * 0.038,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                />
              ))
            : null}

          <motion.div
            className="relative z-[2] flex w-full max-w-lg flex-col items-center px-6 text-center sm:max-w-xl"
            initial={false}
            animate={
              !reducedMotion && isLocalNext ? { x: [0, -5, 5, -3, 3, 0] } : { x: 0 }
            }
            transition={{ duration: 0.36, ease: "easeOut" }}
          >
            <motion.p
              className="mb-2 max-w-md px-4 text-center text-ui-caption font-semibold uppercase tracking-[0.2em] text-secondary sm:mb-2.5 sm:text-xs"
              initial={reducedMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
            >
              {t("phase.nextTurnImpactEyebrow")}
            </motion.p>

            <motion.p
              className="font-headline text-2xl font-black uppercase tracking-tight text-foreground drop-shadow-[0_3px_16px_hsl(var(--primary)/0.45)] sm:text-5xl"
              initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.68, filter: "blur(12px)" }}
              animate={
                reducedMotion
                  ? { opacity: 1, scale: 1, filter: "blur(0px)" }
                  : { opacity: 1, scale: 1, filter: "blur(0px)" }
              }
              exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.92, filter: "blur(8px)" }}
              transition={reducedMotion ? PHASE_TRANSITION_REDUCED : TITLE_SPRING}
            >
              <motion.span
                className="inline-block bg-gradient-to-b from-foreground via-foreground to-primary/90 bg-clip-text text-transparent"
                animate={
                  reducedMotion ? {} : { scale: [1, 1.06, 1, 1.04, 1] }
                }
                transition={{ duration: 0.85, ease: "easeInOut", times: [0, 0.22, 0.44, 0.66, 1] }}
              >
                {t("phase.nextTurnImpactTitle")}
              </motion.span>
            </motion.p>

            <motion.p
              className="mt-3 max-w-md font-headline text-xl font-bold text-primary drop-shadow-[0_2px_12px_hsl(var(--background)/0.85)] sm:mt-4 sm:text-3xl"
              initial={reducedMotion ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={TITLE_SPRING}
            >
              {nextActorNickname.trim() || t("common.unknownPlayer", { ns: "common" })}
            </motion.p>

            {isLocalNext ? (
              <motion.p
                className="mt-3 font-headline text-lg font-semibold text-secondary drop-shadow-[0_2px_10px_hsl(var(--background)/0.75)] sm:mt-3.5 sm:text-xl"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={TITLE_SPRING}
              >
                {t("phase.nextTurnImpactLocal")}
              </motion.p>
            ) : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
