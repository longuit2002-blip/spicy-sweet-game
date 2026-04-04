"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion, type Transition } from "framer-motion";
import { useTranslation } from "react-i18next";
import type { ChallengeResult } from "@/shared/types/game";
import { GAME_PHASE, type GamePhase } from "@/shared/types/game";
import {
  isLocalChallengeLoser,
  isLocalChallengeWinner,
} from "@/features/game/lib/challenge-outcome-local";
import {
  CHALLENGE_REVEAL_IMPACT_HOLD_MS,
  CHALLENGE_REVEAL_IMPACT_Z,
  REVEAL_REMAIN_AFTER_LOCK_THRESHOLD,
} from "@/lib/game-room.constants";
import { PHASE_TRANSITION_REDUCED } from "@/features/game/animations";

const DIM_ENTER: Transition = { duration: 0.22, ease: [0.32, 0.72, 0, 1] };
const DIM_EXIT: Transition = { duration: 0.2, ease: [0.4, 0, 0.2, 1] };
const TITLE_SPRING: Transition = { type: "spring", stiffness: 320, damping: 26 };

const RING_COUNT = 4;
const RING_DELAYS = [0, 0.07, 0.14, 0.21] as const;

const SPARKLE_COUNT = 14;

export type ChallengeRevealImpactOverlayProps = {
  phase: GamePhase;
  challengeResult: ChallengeResult | null;
  localPlayerId: string;
  /** Server `challengeTimer` in `REVEAL` — drives lock vs flip vs outcome pacing. */
  challengeTimer: number;
};

/**
 * Full-viewport REVEAL outcome: shockwave + sparkles + local win/lose wash.
 * Auto-dismisses after {@link CHALLENGE_REVEAL_IMPACT_HOLD_MS} (tune in `game-room.constants`).
 */
export function ChallengeRevealImpactOverlay({
  phase,
  challengeResult,
  localPlayerId,
  challengeTimer,
}: ChallengeRevealImpactOverlayProps) {
  const { t } = useTranslation("game");
  const reducedMotion = useReducedMotion() === true;
  const [mounted, setMounted] = useState(false);
  const [autoDismissed, setAutoDismissed] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const active = phase === GAME_PHASE.REVEAL && challengeResult != null;
  const inRevealLock =
    active && challengeResult != null && challengeTimer > REVEAL_REMAIN_AFTER_LOCK_THRESHOLD;

  const showImpactShell = active && challengeResult != null && !inRevealLock;

  useEffect(() => {
    if (!showImpactShell) {
      setAutoDismissed(false);
      return;
    }
    setAutoDismissed(false);
    const id = window.setTimeout(() => setAutoDismissed(true), CHALLENGE_REVEAL_IMPACT_HOLD_MS);
    return () => window.clearTimeout(id);
  }, [showImpactShell]);

  const portalVisible = showImpactShell && !autoDismissed;

  const localWin =
    portalVisible && challengeResult != null && isLocalChallengeWinner(challengeResult, localPlayerId);
  const localLose =
    portalVisible && challengeResult != null && isLocalChallengeLoser(challengeResult, localPlayerId);

  const sparkleAngles = useMemo(
    () => Array.from({ length: SPARKLE_COUNT }, (_, i) => (i / SPARKLE_COUNT) * Math.PI * 2),
    [],
  );

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {portalVisible && challengeResult ? (
        <motion.div
          key="challenge-reveal-impact"
          className="pointer-events-none fixed inset-0 flex flex-col items-center justify-center overflow-hidden"
          style={{ zIndex: CHALLENGE_REVEAL_IMPACT_Z }}
          initial={reducedMotion ? { opacity: 0 } : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
          transition={reducedMotion ? PHASE_TRANSITION_REDUCED : DIM_ENTER}
          aria-hidden
        >
          <motion.div
            className="absolute inset-0 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={reducedMotion ? PHASE_TRANSITION_REDUCED : DIM_EXIT}
          />

          {localWin ? (
            <motion.div
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={
                reducedMotion
                  ? { opacity: 0.45 }
                  : { opacity: [0.38, 0.78, 0.5, 0.68, 0.44] }
              }
              transition={
                reducedMotion
                  ? { duration: 0.3 }
                  : { duration: 1.85, repeat: Infinity, ease: "easeInOut" }
              }
              style={{
                background:
                  "radial-gradient(ellipse 100% 80% at 50% 38%, hsl(var(--secondary) / 0.52) 0%, hsl(var(--primary) / 0.26) 42%, transparent 68%)",
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
                  : { opacity: [0.44, 0.82, 0.52, 0.72, 0.46] }
              }
              transition={
                reducedMotion
                  ? { duration: 0.3 }
                  : { duration: 1.75, repeat: Infinity, ease: "easeInOut" }
              }
              style={{
                background:
                  "radial-gradient(ellipse 105% 85% at 50% 40%, hsl(var(--destructive) / 0.55) 0%, hsl(var(--destructive) / 0.16) 50%, transparent 72%)",
              }}
            />
          ) : null}

          {!reducedMotion
            ? RING_DELAYS.slice(0, RING_COUNT).map((delay, i) => (
                <motion.div
                  key={`ring-${i}`}
                  className="pointer-events-none absolute left-1/2 top-[40%] h-[min(82vmin,380px)] w-[min(82vmin,380px)] -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-primary/50 sm:h-[min(92vmin,520px)] sm:w-[min(92vmin,520px)]"
                  initial={{ scale: 0.08, opacity: 0.72 }}
                  animate={{ scale: 1.72, opacity: 0 }}
                  transition={{
                    duration: 0.78,
                    delay,
                    ease: [0.2, 0.9, 0.2, 1],
                  }}
                />
              ))
            : null}

          {!reducedMotion
            ? sparkleAngles.map((angle, i) => (
                <motion.div
                  key={`spark-${i}`}
                  className="pointer-events-none absolute left-1/2 top-[40%] h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_12px_hsl(var(--primary)/0.9)]"
                  initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
                  animate={{
                    opacity: [0, 1, 0.85, 0],
                    scale: [0.25, 1.15, 0.9, 0.2],
                    x: [0, Math.cos(angle) * (88 + (i % 4) * 12)],
                    y: [0, Math.sin(angle) * (64 + (i % 3) * 10)],
                  }}
                  transition={{
                    duration: 0.82,
                    delay: i * 0.035,
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
                ? { x: [0, -6, 6, -4, 4, 0] }
                : { x: 0 }
            }
            transition={{ duration: 0.38, ease: "easeOut" }}
          >
            <motion.p
              className="mb-2 max-w-md px-4 text-center text-ui-caption font-semibold uppercase tracking-wide text-primary sm:mb-2.5 sm:text-xs"
              initial={reducedMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.24, ease: [0.32, 0.72, 0, 1] }}
            >
              {challengeResult.challengeType === "suit"
                ? t("challenge.revealAxisSuit")
                : t("challenge.revealAxisNumber")}
            </motion.p>

            <motion.p
              className="font-headline text-2xl font-black uppercase tracking-tight text-foreground drop-shadow-[0_2px_12px_hsl(var(--background)/0.85)] sm:text-4xl"
              initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.72, filter: "blur(10px)" }}
              animate={
                reducedMotion
                  ? { opacity: 1, scale: 1, filter: "blur(0px)" }
                  : { opacity: 1, scale: 1, filter: "blur(0px)" }
              }
              exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94, filter: "blur(6px)" }}
              transition={reducedMotion ? PHASE_TRANSITION_REDUCED : TITLE_SPRING}
            >
              <motion.span
                className="inline-block"
                animate={
                  reducedMotion
                    ? {}
                    : { scale: [1, 1.045, 1, 1.03, 1] }
                }
                transition={{ duration: 0.9, ease: "easeInOut", times: [0, 0.25, 0.5, 0.75, 1] }}
              >
                {t("phase.revealImpactNeutral")}
              </motion.span>
            </motion.p>

            {localWin ? (
              <motion.p
                className="mt-3 font-headline text-xl font-bold text-secondary drop-shadow-[0_2px_10px_hsl(var(--background)/0.8)] sm:mt-4 sm:text-2xl"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={TITLE_SPRING}
              >
                {t("phase.revealImpactLocalWin")}
              </motion.p>
            ) : null}

            {localLose ? (
              <motion.p
                className="mt-3 font-headline text-xl font-bold text-destructive drop-shadow-[0_2px_10px_hsl(var(--background)/0.8)] sm:mt-4 sm:text-2xl"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={TITLE_SPRING}
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
