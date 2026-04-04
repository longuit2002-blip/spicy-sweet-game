"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion, type Transition } from "framer-motion";
import { useTranslation } from "react-i18next";
import type { ChallengeResult } from "@/shared/types/game";
import { GAME_PHASE, SPICE_EMOJI, SPICE_LABEL, type GamePhase } from "@/shared/types/game";
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
import { useIsMobile } from "@/hooks/use-mobile";
import { Icon } from "@/components/ui/icon";
import { SpiceCard } from "@/features/game/components/SpiceCard";
import { cn } from "@/lib/utils";

const DIM_ENTER: Transition = { duration: 0.22, ease: [0.32, 0.72, 0, 1] };
const DIM_EXIT: Transition = { duration: 0.2, ease: [0.4, 0, 0.2, 1] };
const TITLE_SPRING: Transition = { type: "spring", stiffness: 320, damping: 26 };
const CARD_POP_SPRING: Transition = { type: "spring", stiffness: 280, damping: 22 };

const RING_COUNT = 4;
const RING_DELAYS = [0, 0.07, 0.14, 0.21] as const;

const SPARKLE_COUNT = 14;
const SPARKLE_COUNT_MOBILE = 6;

export type ChallengeRevealImpactOverlayProps = {
  phase: GamePhase;
  challengeResult: ChallengeResult | null;
  localPlayerId: string;
  /** Server `challengeTimer` in `REVEAL` — drives lock vs flip vs outcome pacing. */
  challengeTimer: number;
  /** Player names for display — looked up by BoardView from the players array. */
  challengeOutcomeNames?: { challenger: string; declarer: string } | null;
};

/**
 * Full-viewport REVEAL outcome: shockwave + sparkles + card comparison + local win/lose wash.
 * Shows declared card vs real card side-by-side with outcome-specific headline.
 * Auto-dismisses after {@link CHALLENGE_REVEAL_IMPACT_HOLD_MS} (tune in `game-room.constants`).
 */
export function ChallengeRevealImpactOverlay({
  phase,
  challengeResult,
  localPlayerId,
  challengeTimer,
  challengeOutcomeNames = null,
}: ChallengeRevealImpactOverlayProps) {
  const { t } = useTranslation("game");
  const reducedMotion = useReducedMotion() === true;
  const isMobile = useIsMobile();
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

  const effectiveSparkleCount = isMobile ? SPARKLE_COUNT_MOBILE : SPARKLE_COUNT;
  const sparkleAngles = useMemo(
    () => Array.from({ length: effectiveSparkleCount }, (_, i) => (i / effectiveSparkleCount) * Math.PI * 2),
    [effectiveSparkleCount],
  );

  /** Outcome-specific headline instead of generic "Round resolved". */
  const headline = useMemo(() => {
    if (!challengeResult) return "";
    if (challengeResult.timedOut && !challengeResult.challengeCorrect) {
      return t("phase.revealImpactTimedOut");
    }
    return challengeResult.challengeCorrect
      ? t("challenge.bluffCaught")
      : t("result.wasTruth");
  }, [challengeResult, t]);

  /** Icon + color tone for the outcome. */
  const outcomeStyle = useMemo(() => {
    if (!challengeResult) return { icon: "help", tone: "text-primary", wash: "" } as const;
    const timedOut = challengeResult.timedOut && !challengeResult.challengeCorrect;
    if (timedOut) {
      return {
        icon: "timer_off" as const,
        tone: "text-trophy-gold",
        wash: "radial-gradient(ellipse 108% 86% at 50% 36%, hsl(var(--trophy-gold) / 0.38) 0%, hsl(var(--trophy-gold) / 0.1) 44%, transparent 70%)",
      };
    }
    if (challengeResult.challengeCorrect) {
      return {
        icon: "gpp_bad" as const,
        tone: "text-destructive",
        wash: "radial-gradient(ellipse 105% 85% at 50% 38%, hsl(var(--destructive) / 0.48) 0%, hsl(var(--destructive) / 0.14) 48%, transparent 70%)",
      };
    }
    return {
      icon: "verified" as const,
      tone: "text-secondary",
      wash: "radial-gradient(ellipse 100% 80% at 50% 38%, hsl(var(--secondary) / 0.52) 0%, hsl(var(--primary) / 0.26) 42%, transparent 68%)",
    };
  }, [challengeResult]);

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {portalVisible && challengeResult ? (
        <motion.div
          key="challenge-reveal-impact"
          className="pointer-events-none fixed inset-0 flex flex-col items-center justify-center overflow-hidden px-3 py-4 sm:px-6"
          style={{ zIndex: CHALLENGE_REVEAL_IMPACT_Z }}
          initial={reducedMotion ? { opacity: 0 } : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
          transition={reducedMotion ? PHASE_TRANSITION_REDUCED : DIM_ENTER}
          aria-hidden
        >
          {/* Dimmer */}
          <motion.div
            className="absolute inset-0 bg-black/48"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={reducedMotion ? PHASE_TRANSITION_REDUCED : DIM_EXIT}
          />

          {/* Outcome color wash */}
          <motion.div
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={
              reducedMotion
                ? { opacity: 0.5 }
                : { opacity: [0.4, 0.78, 0.52, 0.68, 0.44] }
            }
            transition={
              reducedMotion
                ? { duration: 0.3 }
                : { duration: 1.85, repeat: Infinity, ease: "easeInOut" }
            }
            style={{ background: outcomeStyle.wash }}
          />

          {/* Local win/lose extra wash */}
          {localWin ? (
            <motion.div
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={
                reducedMotion
                  ? { opacity: 0.3 }
                  : { opacity: [0.2, 0.45, 0.28, 0.38, 0.22] }
              }
              transition={
                reducedMotion
                  ? { duration: 0.3 }
                  : { duration: 1.85, repeat: Infinity, ease: "easeInOut" }
              }
              style={{
                background:
                  "radial-gradient(ellipse 90% 70% at 50% 50%, hsl(var(--secondary) / 0.35) 0%, transparent 60%)",
              }}
            />
          ) : null}

          {localLose ? (
            <motion.div
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={
                reducedMotion
                  ? { opacity: 0.3 }
                  : { opacity: [0.25, 0.5, 0.3, 0.42, 0.26] }
              }
              transition={
                reducedMotion
                  ? { duration: 0.3 }
                  : { duration: 1.75, repeat: Infinity, ease: "easeInOut" }
              }
              style={{
                background:
                  "radial-gradient(ellipse 95% 75% at 50% 50%, hsl(var(--destructive) / 0.35) 0%, transparent 62%)",
              }}
            />
          ) : null}

          {/* Shockwave rings */}
          {!reducedMotion
            ? RING_DELAYS.slice(0, RING_COUNT).map((delay, i) => (
                <motion.div
                  key={`ring-${i}`}
                  className="pointer-events-none absolute left-1/2 top-[38%] h-[min(82vmin,380px)] w-[min(82vmin,380px)] -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-primary/50 sm:h-[min(92vmin,520px)] sm:w-[min(92vmin,520px)]"
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

          {/* Sparkles */}
          {!reducedMotion
            ? sparkleAngles.map((angle, i) => (
                <motion.div
                  key={`spark-${i}`}
                  className="pointer-events-none absolute left-1/2 top-[38%] h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_12px_hsl(var(--primary)/0.9)]"
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

          {/* Content */}
          <motion.div
            className="relative z-[2] flex w-full max-w-lg flex-col items-center text-center sm:max-w-xl"
            initial={false}
            animate={
              !reducedMotion && localLose
                ? { x: [0, -6, 6, -4, 4, 0] }
                : { x: 0 }
            }
            transition={{ duration: 0.38, ease: "easeOut" }}
          >
            {/* Outcome icon */}
            <motion.div
              initial={reducedMotion ? false : { scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ ...TITLE_SPRING, delay: reducedMotion ? 0 : 0.02 }}
              className={cn(
                "mb-3 flex h-14 w-14 items-center justify-center rounded-full border-[3px] sm:mb-4 sm:h-[4.5rem] sm:w-[4.5rem]",
                challengeResult.challengeCorrect
                  ? "border-destructive/50 bg-destructive/15 shadow-[0_0_28px_hsl(var(--destructive)/0.3)]"
                  : challengeResult.timedOut
                    ? "border-trophy-gold/50 bg-trophy-gold/12 shadow-[0_0_24px_hsl(var(--trophy-gold)/0.25)]"
                    : "border-secondary/50 bg-secondary/18 shadow-[0_0_28px_hsl(var(--secondary)/0.25)]",
              )}
              aria-hidden
            >
              <Icon
                name={outcomeStyle.icon}
                size={isMobile ? 32 : 40}
                className={outcomeStyle.tone}
                fill={1}
              />
            </motion.div>

            {/* Headline: "BLUFF CAUGHT!" / "TRUTH TOLD!" / "Timed out" */}
            <motion.p
              className={cn(
                "font-headline text-2xl font-black uppercase tracking-tight drop-shadow-[0_2px_12px_hsl(var(--background)/0.85)] sm:text-4xl",
                challengeResult.challengeCorrect
                  ? "text-destructive"
                  : challengeResult.timedOut
                    ? "text-trophy-gold"
                    : "text-secondary",
              )}
              initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.72, filter: "blur(10px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94, filter: "blur(6px)" }}
              transition={reducedMotion ? PHASE_TRANSITION_REDUCED : TITLE_SPRING}
            >
              <motion.span
                className="inline-block"
                animate={
                  reducedMotion
                    ? {}
                    : { scale: [1, 1.06, 1, 1.03, 1] }
                }
                transition={{ duration: 0.9, ease: "easeInOut", times: [0, 0.25, 0.5, 0.75, 1] }}
              >
                {headline}
              </motion.span>
            </motion.p>

            {/* Card comparison: Declared vs Real */}
            <motion.div
              className="mt-4 flex w-full max-w-sm items-center justify-center gap-3 sm:mt-5 sm:gap-4"
              initial={reducedMotion ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...CARD_POP_SPRING, delay: reducedMotion ? 0 : 0.12 }}
            >
              {/* Declared card */}
              <div className="flex flex-col items-center gap-1.5">
                <p className="text-ui-caption font-bold uppercase tracking-wider text-muted-foreground sm:text-xs">
                  {t("phase.revealDeclaredLabel")}
                </p>
                <div className={cn(
                  "relative overflow-hidden rounded-lg border-2 border-dashed px-2.5 py-2 sm:px-3 sm:py-2.5",
                  challengeResult.challengeCorrect
                    ? "border-destructive/40 bg-destructive/8"
                    : "border-secondary/40 bg-secondary/8",
                )}>
                  <p className="font-headline text-base font-bold tabular-nums text-foreground sm:text-lg">
                    {SPICE_EMOJI[challengeResult.declaredCard.type]}{" "}
                    {SPICE_LABEL[challengeResult.declaredCard.type]}{" "}
                    <span className="text-primary">{challengeResult.declaredCard.number}</span>
                  </p>
                </div>
              </div>

              {/* VS divider */}
              <motion.div
                className="flex flex-col items-center gap-0.5"
                initial={reducedMotion ? false : { scale: 0, rotate: -90 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ ...CARD_POP_SPRING, delay: reducedMotion ? 0 : 0.2 }}
              >
                <div className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border-2 font-headline text-xs font-black sm:h-9 sm:w-9 sm:text-sm",
                  challengeResult.challengeCorrect
                    ? "border-destructive/50 bg-destructive/20 text-destructive"
                    : "border-secondary/50 bg-secondary/20 text-secondary",
                )}>
                  VS
                </div>
              </motion.div>

              {/* Real card */}
              <div className="flex flex-col items-center gap-1.5">
                <p className="text-ui-caption font-bold uppercase tracking-wider text-muted-foreground sm:text-xs">
                  {t("phase.revealRealLabel")}
                </p>
                <motion.div
                  className="relative w-16 sm:w-20"
                  initial={reducedMotion ? false : { rotateY: 90, opacity: 0 }}
                  animate={{ rotateY: 0, opacity: 1 }}
                  transition={{ ...CARD_POP_SPRING, delay: reducedMotion ? 0 : 0.25 }}
                  style={{ perspective: 800 }}
                >
                  <SpiceCard card={challengeResult.realCard} size="small" />
                </motion.div>
              </div>
            </motion.div>

            {/* Axis label */}
            <motion.p
              className="mt-3 max-w-md px-4 text-center text-ui-caption font-semibold uppercase tracking-wide text-primary/80 sm:mt-4 sm:text-xs"
              initial={reducedMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.24, delay: reducedMotion ? 0 : 0.3, ease: [0.32, 0.72, 0, 1] }}
            >
              {challengeResult.challengeType === "suit"
                ? t("challenge.revealAxisSuit")
                : t("challenge.revealAxisNumber")}
            </motion.p>

            {/* Local win/lose subline */}
            {localWin ? (
              <motion.p
                className="mt-2 font-headline text-lg font-bold text-secondary drop-shadow-[0_2px_10px_hsl(var(--background)/0.8)] sm:mt-3 sm:text-2xl"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...TITLE_SPRING, delay: reducedMotion ? 0 : 0.35 }}
              >
                {t("phase.revealImpactLocalWin")}
              </motion.p>
            ) : null}

            {localLose ? (
              <motion.p
                className="mt-2 font-headline text-lg font-bold text-destructive drop-shadow-[0_2px_10px_hsl(var(--background)/0.8)] sm:mt-3 sm:text-2xl"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...TITLE_SPRING, delay: reducedMotion ? 0 : 0.35 }}
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
