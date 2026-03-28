"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion, type Transition } from "framer-motion";
import { useTranslation } from "react-i18next";
import type { ChallengeResult } from "@/shared/types/game";
import { GAME_PHASE, type GamePhase } from "@/shared/types/game";
import {
  isLocalChallengeLoser,
  isLocalChallengeWinner,
} from "@/features/game/lib/challenge-outcome-local";
import { CHALLENGE_REVEAL_IMPACT_Z } from "@/lib/game-room.constants";
import { PHASE_TRANSITION_REDUCED } from "@/features/game/animations";

const DIM_ENTER: Transition = { duration: 0.35, ease: [0.32, 0.72, 0, 1] };
const TITLE_SPRING: Transition = { type: "spring", stiffness: 280, damping: 28 };

const RING_DELAYS = [0, 0.12, 0.24] as const;

export type ChallengeRevealImpactOverlayProps = {
  phase: GamePhase;
  challengeResult: ChallengeResult | null;
  localPlayerId: string;
};

/**
 * Full-viewport REVEAL outcome: neutral shockwave for every seat + stronger local win/lose wash.
 * In-flow callout under the table card is omitted — this replaces it visually.
 */
export function ChallengeRevealImpactOverlay({
  phase,
  challengeResult,
  localPlayerId,
}: ChallengeRevealImpactOverlayProps) {
  const { t } = useTranslation("game");
  const reducedMotion = useReducedMotion() === true;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const active = phase === GAME_PHASE.REVEAL && challengeResult != null;
  const localWin =
    active && challengeResult != null && isLocalChallengeWinner(challengeResult, localPlayerId);
  const localLose =
    active && challengeResult != null && isLocalChallengeLoser(challengeResult, localPlayerId);

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {active && challengeResult ? (
        <motion.div
          key="challenge-reveal-impact"
          className="pointer-events-none fixed inset-0 flex flex-col items-center justify-center overflow-hidden"
          style={{ zIndex: CHALLENGE_REVEAL_IMPACT_Z }}
          initial={reducedMotion ? { opacity: 0 } : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={reducedMotion ? PHASE_TRANSITION_REDUCED : DIM_ENTER}
          aria-hidden
        >
          <motion.div
            className="absolute inset-0 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={reducedMotion ? PHASE_TRANSITION_REDUCED : DIM_ENTER}
          />

          {localWin ? (
            <motion.div
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={
                reducedMotion
                  ? { opacity: 0.45 }
                  : { opacity: [0.35, 0.72, 0.48, 0.65, 0.42] }
              }
              transition={
                reducedMotion
                  ? { duration: 0.3 }
                  : { duration: 2.4, repeat: Infinity, ease: "easeInOut" }
              }
              style={{
                background:
                  "radial-gradient(ellipse 100% 80% at 50% 38%, hsl(var(--secondary) / 0.5) 0%, hsl(var(--primary) / 0.22) 42%, transparent 68%)",
              }}
            />
          ) : null}

          {localLose ? (
            <motion.div
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={
                reducedMotion
                  ? { opacity: 0.5 }
                  : { opacity: [0.42, 0.78, 0.5, 0.68, 0.45] }
              }
              transition={
                reducedMotion
                  ? { duration: 0.3 }
                  : { duration: 2.2, repeat: Infinity, ease: "easeInOut" }
              }
              style={{
                background:
                  "radial-gradient(ellipse 105% 85% at 50% 40%, hsl(var(--destructive) / 0.52) 0%, hsl(var(--destructive) / 0.14) 50%, transparent 72%)",
              }}
            />
          ) : null}

          {!reducedMotion
            ? RING_DELAYS.map((delay, i) => (
                <motion.div
                  key={`ring-${i}`}
                  className="pointer-events-none absolute left-1/2 top-[40%] h-[min(92vmin,520px)] w-[min(92vmin,520px)] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary/45"
                  initial={{ scale: 0.12, opacity: 0.65 }}
                  animate={{ scale: 1.55, opacity: 0 }}
                  transition={{
                    duration: 1.05,
                    delay,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                />
              ))
            : null}

          <motion.div
            className="relative z-[2] flex w-full max-w-lg flex-col items-center px-6 text-center sm:max-w-xl"
            initial={false}
            animate={
              !reducedMotion && localLose
                ? { x: [0, -5, 5, -4, 4, 0] }
                : { x: 0 }
            }
            transition={{ duration: 0.42, ease: "easeOut" }}
          >
            <motion.p
              className="font-headline text-2xl font-black uppercase tracking-tight text-foreground drop-shadow-[0_2px_12px_hsl(var(--background)/0.85)] sm:text-4xl"
              initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.76, filter: "blur(8px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.92 }}
              transition={reducedMotion ? PHASE_TRANSITION_REDUCED : TITLE_SPRING}
            >
              {t("phase.revealImpactNeutral")}
            </motion.p>

            {localWin ? (
              <motion.p
                className="mt-3 font-headline text-xl font-bold text-secondary drop-shadow-[0_2px_10px_hsl(var(--background)/0.8)] sm:mt-4 sm:text-2xl"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...TITLE_SPRING, delay: reducedMotion ? 0 : 0.08 }}
              >
                {t("phase.revealImpactLocalWin")}
              </motion.p>
            ) : null}

            {localLose ? (
              <motion.p
                className="mt-3 font-headline text-xl font-bold text-destructive drop-shadow-[0_2px_10px_hsl(var(--background)/0.8)] sm:mt-4 sm:text-2xl"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...TITLE_SPRING, delay: reducedMotion ? 0 : 0.08 }}
              >
                {t("phase.revealImpactLocalLose")}
              </motion.p>
            ) : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
