"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion, type Transition } from "framer-motion";
import { useTranslation } from "react-i18next";
import { PENALTY_DRAW_COUNT } from "@sweet-spicy/game-logic";
import { Icon } from "@/components/ui/icon";
import type { PenaltyFxSnapshot } from "@/features/game/components/RoundResolutionFxOverlay";
import { PHASE_TRANSITION_REDUCED } from "@/features/game/animations";
import { DEFAULT_LOBBY_NICKNAME, PENALTY_RESULT_IMPACT_Z } from "@/lib/game-room.constants";
import { cn } from "@/lib/utils";
import { GAME_PHASE, type GamePhase } from "@/shared/types/game";

const DIM_ENTER: Transition = { duration: 0.26, ease: [0.32, 0.72, 0, 1] };
const DIM_EXIT: Transition = { duration: 0.34, ease: [0.4, 0, 0.2, 1] };
const TITLE_SPRING: Transition = { type: "spring", stiffness: 300, damping: 22 };

const RING_COUNT = 6;
const RING_DELAYS = [0, 0.05, 0.1, 0.15, 0.2, 0.25] as const;
const SPARKLE_COUNT = 16;

export type PenaltyResultImpactOverlayProps = {
  phase: GamePhase;
  penaltyFxSnapshot: PenaltyFxSnapshot | null;
  localPlayerId: string;
  players: readonly { id: string; nickname: string }[];
};

function displayName(nickname: string): string {
  const n = nickname.trim();
  return n.length > 0 ? n : DEFAULT_LOBBY_NICKNAME;
}

function initialFromName(name: string): string {
  return name[0]?.toUpperCase() ?? "?";
}

type OutcomeVariant = "caught" | "truth" | "timeout";

function OutcomePlayerBand({
  eyebrow,
  playerId,
  nickname,
  localPlayerId,
  youLabel,
  outcomeKind,
  pileCardCount,
  iconToneClass,
  bandClass,
  reducedMotion,
}: {
  eyebrow: string;
  playerId: string;
  nickname: string;
  localPlayerId: string;
  youLabel: string;
  outcomeKind: "pile" | "draw";
  pileCardCount: number;
  iconToneClass: string;
  bandClass: string;
  reducedMotion: boolean;
}) {
  const { t } = useTranslation("game");
  const name = displayName(nickname);
  const initial = initialFromName(name);
  const caption =
    outcomeKind === "pile" ? t("phase.penaltyOutcomePileCaption") : t("phase.penaltyOutcomeDrawCaption");
  const hero =
    outcomeKind === "pile" ? (
      <span className="font-headline text-2xl font-black tabular-nums leading-none tracking-tight text-foreground sm:text-3xl">
        {pileCardCount}
      </span>
    ) : (
      <span className="font-headline text-2xl font-black tabular-nums leading-none tracking-tight text-foreground sm:text-3xl">
        +{PENALTY_DRAW_COUNT}
      </span>
    );

  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 14, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={TITLE_SPRING}
      className={cn(
        "flex min-w-0 max-w-[min(100%,20rem)] flex-col gap-2 rounded-2xl border px-3 py-3 shadow-md sm:gap-2.5 sm:px-4 sm:py-3.5",
        "border-border/55 bg-background/88 ring-1 ring-border/30 backdrop-blur-sm",
        bandClass,
      )}
    >
      <p className="text-center text-ui-micro font-bold uppercase tracking-[0.12em] text-muted-foreground sm:text-ui-caption">
        {eyebrow}
      </p>
      <div className="flex flex-col items-center gap-2">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-primary/35 bg-primary/12 font-headline text-sm font-black text-foreground shadow-inner sm:h-12 sm:w-12 sm:text-base"
          aria-hidden
        >
          {initial}
        </div>
        <div className="flex min-w-0 flex-col items-center gap-1">
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            <p className="line-clamp-2 text-center font-headline text-sm font-black text-foreground sm:text-base">
              {name}
            </p>
            {playerId === localPlayerId ? (
              <span className="shrink-0 rounded-md border border-primary/35 bg-primary/12 px-1.5 py-0.5 text-ui-tiny font-bold uppercase tracking-wider text-primary">
                {youLabel}
              </span>
            ) : null}
          </div>
        </div>
      </div>
      <div
        className={cn(
          "mt-0.5 flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2.5 sm:gap-3 sm:px-3 sm:py-3",
          bandClass,
        )}
      >
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border shadow-inner sm:h-11 sm:w-11",
            iconToneClass,
          )}
          aria-hidden
        >
          <Icon
            name={outcomeKind === "pile" ? "layers" : "playing_cards"}
            size={26}
            className={outcomeKind === "pile" ? "text-secondary" : "text-destructive"}
            fill={1}
          />
        </div>
        <div className="min-w-0 flex-1 text-left">
          {hero}
          <p className="mt-0.5 text-ui-tiny font-bold text-muted-foreground sm:text-ui-caption">{caption}</p>
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Full-viewport round result after a challenge — copy stays on screen for the whole `PENALTY` phase (server-timed).
 * Renders **under** {@link ROUND_RESOLUTION_FX_Z} so pile/draw flights read above the dimmer.
 */
export function PenaltyResultImpactOverlay({
  phase,
  penaltyFxSnapshot,
  localPlayerId,
  players,
}: PenaltyResultImpactOverlayProps) {
  const { t } = useTranslation("game");
  const reducedMotion = useReducedMotion() === true;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const active = phase === GAME_PHASE.PENALTY && penaltyFxSnapshot != null;
  const r = penaltyFxSnapshot?.result;

  const unknown = t("common.unknownPlayer", { ns: "common" });
  const challengerNick = players.find((p) => p.id === r?.challengerId)?.nickname ?? unknown;
  const declarerNick = players.find((p) => p.id === r?.playerId)?.nickname ?? unknown;

  const variant: OutcomeVariant | null = r
    ? r.challengeCorrect
      ? "caught"
      : r.timedOut
        ? "timeout"
        : "truth"
    : null;

  const fullSummarySr =
    r != null
      ? r.challengeCorrect
        ? t("phase.penaltyChallengerWins", {
            challenger: displayName(challengerNick),
            declarer: displayName(declarerNick),
            count: penaltyFxSnapshot?.pileCardCount ?? 0,
          })
        : t("phase.penaltyDeclarerWins", {
            declarer: displayName(declarerNick),
            challenger: displayName(challengerNick),
          })
      : "";

  const headline =
    variant === "caught"
      ? t("phase.penaltyTitleBluffCaught")
      : variant === "timeout"
        ? t("phase.penaltyTitleTimedOut")
        : variant === "truth"
          ? t("phase.penaltyTitleTruth")
          : "";

  const heroIcon =
    variant === "caught" ? (
      <Icon name="gpp_bad" size={40} className="text-destructive" fill={1} aria-hidden />
    ) : variant === "timeout" ? (
      <Icon name="timer_off" size={40} className="text-trophy-gold" fill={1} aria-hidden />
    ) : variant === "truth" ? (
      <Icon name="verified" size={40} className="text-secondary" fill={1} aria-hidden />
    ) : null;

  const heroRing =
    variant === "caught"
      ? "border-destructive/45 bg-destructive/[0.14] shadow-[0_0_28px_hsl(var(--destructive)/0.25)]"
      : variant === "timeout"
        ? "border-trophy-gold/45 bg-trophy-gold/12 shadow-[0_0_24px_hsl(var(--trophy-gold)/0.2)]"
        : variant === "truth"
          ? "border-secondary/45 bg-secondary/16 shadow-[0_0_28px_hsl(var(--secondary)/0.22)]"
          : "";

  const washStyle =
    variant === "caught"
      ? "radial-gradient(ellipse 110% 88% at 50% 34%, hsl(var(--destructive) / 0.42) 0%, hsl(var(--destructive) / 0.12) 45%, transparent 72%)"
      : variant === "timeout"
        ? "radial-gradient(ellipse 108% 86% at 50% 36%, hsl(var(--trophy-gold) / 0.38) 0%, hsl(var(--trophy-gold) / 0.1) 44%, transparent 70%)"
        : variant === "truth"
          ? "radial-gradient(ellipse 110% 88% at 50% 34%, hsl(var(--secondary) / 0.44) 0%, hsl(var(--primary) / 0.18) 42%, transparent 70%)"
          : "transparent";

  const pileBandExtra =
    variant === "caught" ? "ring-destructive/15" : variant === "truth" ? "ring-secondary/15" : "";
  const drawBandExtra = "ring-destructive/12";

  const sparkleAngles = useMemo(
    () => Array.from({ length: SPARKLE_COUNT }, (_, i) => (i / SPARKLE_COUNT) * Math.PI * 2),
    [],
  );

  const receivesPileRole = t("phase.penaltyRoleReceivesPile");
  const penaltyDrawRole = t("phase.penaltyRolePenaltyDraw");
  const you = t("seat.you");
  const pileN = penaltyFxSnapshot?.pileCardCount ?? 0;

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {active && r && variant ? (
        <motion.div
          key="penalty-result-impact"
          role="dialog"
          aria-modal="false"
          aria-labelledby="penalty-result-headline"
          className="pointer-events-none fixed inset-0 flex flex-col items-center justify-center overflow-hidden px-3 py-6 sm:px-6"
          style={{ zIndex: PENALTY_RESULT_IMPACT_Z }}
          initial={reducedMotion ? { opacity: 0 } : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.985 }}
          transition={reducedMotion ? PHASE_TRANSITION_REDUCED : DIM_ENTER}
        >
          <motion.div
            className="absolute inset-0 bg-black/52"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={reducedMotion ? PHASE_TRANSITION_REDUCED : DIM_EXIT}
          />

          <motion.div
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={
              reducedMotion ? { opacity: 0.5 } : { opacity: [0.4, 0.78, 0.52, 0.68, 0.45] }
            }
            transition={
              reducedMotion
                ? { duration: 0.3 }
                : { duration: 2.1, repeat: Infinity, ease: "easeInOut" }
            }
            style={{ background: washStyle }}
          />

          {!reducedMotion
            ? RING_DELAYS.slice(0, RING_COUNT).map((delay, i) => (
                <motion.div
                  key={`pen-ring-${i}`}
                  className="pointer-events-none absolute left-1/2 top-[36%] h-[min(84vmin,400px)] w-[min(84vmin,400px)] -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-primary/55 sm:h-[min(92vmin,520px)] sm:w-[min(92vmin,520px)]"
                  initial={{ scale: 0.05, opacity: 0.82 }}
                  animate={{ scale: 1.82, opacity: 0 }}
                  transition={{
                    duration: 0.88,
                    delay,
                    ease: [0.12, 0.94, 0.18, 1],
                  }}
                />
              ))
            : null}

          {!reducedMotion
            ? sparkleAngles.map((angle, i) => (
                <motion.div
                  key={`pen-spark-${i}`}
                  className="pointer-events-none absolute left-1/2 top-[36%] h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-secondary shadow-[0_0_16px_hsl(var(--secondary)/0.95)]"
                  initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
                  animate={{
                    opacity: [0, 1, 0.88, 0],
                    scale: [0.15, 1.15, 0.85, 0.12],
                    x: [0, Math.cos(angle) * (98 + (i % 5) * 14)],
                    y: [0, Math.sin(angle) * (74 + (i % 4) * 11)],
                  }}
                  transition={{
                    duration: 0.92,
                    delay: i * 0.032,
                    ease: [0.2, 1, 0.34, 1],
                  }}
                />
              ))
            : null}

          <div className="relative z-[2] flex w-full max-w-4xl flex-col items-center">
            <motion.p
              className="mb-2 text-center text-ui-caption font-bold uppercase tracking-[0.22em] text-muted-foreground sm:text-xs"
              initial={reducedMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.24, ease: [0.32, 0.72, 0, 1] }}
            >
              {t("phase.penalty")}
            </motion.p>

            <div className="flex flex-col items-center gap-3 sm:gap-4">
              <motion.div
                initial={reducedMotion ? false : { scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ ...TITLE_SPRING, delay: reducedMotion ? 0 : 0.03 }}
                className={cn(
                  "flex h-[3.85rem] w-[3.85rem] items-center justify-center rounded-full border-[3px] sm:h-[4.5rem] sm:w-[4.5rem]",
                  heroRing,
                )}
                aria-hidden
              >
                {heroIcon}
              </motion.div>

              <motion.h2
                id="penalty-result-headline"
                className="max-w-[min(100%,36rem)] text-center font-headline text-[1.65rem] font-black leading-tight tracking-tight text-foreground drop-shadow-[0_4px_22px_hsl(var(--primary)/0.35)] sm:text-4xl md:text-5xl"
                initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.72, filter: "blur(12px)" }}
                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94, filter: "blur(8px)" }}
                transition={reducedMotion ? PHASE_TRANSITION_REDUCED : TITLE_SPRING}
              >
                <motion.span
                  className="inline-block bg-gradient-to-b from-foreground via-foreground to-primary/92 bg-clip-text text-transparent"
                  animate={reducedMotion ? {} : { scale: [1, 1.05, 1, 1.03, 1] }}
                  transition={{ duration: 1.05, ease: "easeInOut", times: [0, 0.2, 0.42, 0.64, 1] }}
                >
                  {headline}
                </motion.span>
              </motion.h2>
            </div>

            <div className="mt-7 flex w-full min-w-0 flex-col items-stretch justify-center gap-3 sm:mt-9 sm:flex-row sm:items-start sm:gap-4 md:gap-6">
              {r.challengeCorrect ? (
                <>
                  <OutcomePlayerBand
                    eyebrow={receivesPileRole}
                    playerId={r.challengerId}
                    nickname={challengerNick}
                    localPlayerId={localPlayerId}
                    youLabel={you}
                    outcomeKind="pile"
                    pileCardCount={pileN}
                    iconToneClass={
                      variant === "caught"
                        ? "border-destructive/35 bg-destructive/[0.12]"
                        : "border-secondary/4 bg-secondary/[0.14]"
                    }
                    bandClass={cn(
                      "border-destructive/2 bg-destructive/[0.06]",
                      variant === "truth" && "border-secondary/25 bg-secondary/[0.08]",
                      pileBandExtra,
                    )}
                    reducedMotion={reducedMotion}
                  />
                  <div
                    className="hidden shrink-0 flex-col items-center justify-center self-stretch py-1 sm:flex"
                    aria-hidden
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-full border border-border/45 bg-muted/35 text-muted-foreground shadow-inner">
                      <Icon name="arrow_forward" size={26} fill={1} className="opacity-80" />
                    </div>
                  </div>
                  <div className="flex justify-center sm:hidden" aria-hidden>
                    <Icon name="arrow_downward" size={24} fill={1} className="text-muted-foreground opacity-80" />
                  </div>
                  <OutcomePlayerBand
                    eyebrow={penaltyDrawRole}
                    playerId={r.playerId}
                    nickname={declarerNick}
                    localPlayerId={localPlayerId}
                    youLabel={you}
                    outcomeKind="draw"
                    pileCardCount={pileN}
                    iconToneClass="border-destructive/35 bg-destructive/[0.11]"
                    bandClass={cn("border-destructive/25 bg-destructive/[0.07]", drawBandExtra)}
                    reducedMotion={reducedMotion}
                  />
                </>
              ) : (
                <>
                  <OutcomePlayerBand
                    eyebrow={receivesPileRole}
                    playerId={r.playerId}
                    nickname={declarerNick}
                    localPlayerId={localPlayerId}
                    youLabel={you}
                    outcomeKind="pile"
                    pileCardCount={pileN}
                    iconToneClass="border-secondary/4 bg-secondary/[0.14]"
                    bandClass={cn("border-secondary/28 bg-secondary/[0.09]", pileBandExtra)}
                    reducedMotion={reducedMotion}
                  />
                  <div
                    className="hidden shrink-0 flex-col items-center justify-center self-stretch py-1 sm:flex"
                    aria-hidden
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-full border border-border/45 bg-muted/35 text-muted-foreground shadow-inner">
                      <Icon name="arrow_forward" size={26} fill={1} className="opacity-80" />
                    </div>
                  </div>
                  <div className="flex justify-center sm:hidden" aria-hidden>
                    <Icon name="arrow_downward" size={24} fill={1} className="text-muted-foreground opacity-80" />
                  </div>
                  <OutcomePlayerBand
                    eyebrow={penaltyDrawRole}
                    playerId={r.challengerId}
                    nickname={challengerNick}
                    localPlayerId={localPlayerId}
                    youLabel={you}
                    outcomeKind="draw"
                    pileCardCount={pileN}
                    iconToneClass="border-destructive/35 bg-destructive/[0.11]"
                    bandClass={cn("border-destructive/25 bg-destructive/[0.07]", drawBandExtra)}
                    reducedMotion={reducedMotion}
                  />
                </>
              )}
            </div>

            <p className="sr-only">{fullSummarySr}</p>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
