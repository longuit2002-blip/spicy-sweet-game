"use client";

import { useTranslation } from "react-i18next";
import { DEFAULT_LOBBY_NICKNAME } from "@/lib/game-room.constants";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";

export interface ChallengerAxisPickCountdown {
  /** 1 = full time remaining, 0 = none */
  smoothRemainFraction: number;
  displaySeconds: number;
  urgent: boolean;
}

export interface ChallengerAxisRevealLockCountdown {
  seconds: number;
}

export interface ChallengerAxisIdentityStripProps {
  nickname: string;
  phase: "pick" | "lock";
  isLocalPlayer: boolean;
  hint?: string | null;
  challengeAxisDisplay?: "wild" | "number" | null;
  /** PICK: thin bar + seconds beside the player row (replaces a separate bottom timer block). */
  pickCountdown?: ChallengerAxisPickCountdown | null;
  /** REVEAL lock: lock + seconds beside the player row. */
  revealLockCountdown?: ChallengerAxisRevealLockCountdown | null;
  className?: string;
}

/**
 * Challenger identity — tight corners + clear outline (borders for scanability, modest radius).
 */
function ChallengerAxisPickCountdownInline({
  smoothRemainFraction,
  displaySeconds,
  urgent,
}: ChallengerAxisPickCountdown) {
  const { t } = useTranslation("game");
  const pct = Math.max(0, Math.min(100, smoothRemainFraction * 100));

  return (
    <div
      className="flex shrink-0 flex-col items-end gap-1"
      role="timer"
      aria-label={t("challenge.timeRemainingSr", { seconds: displaySeconds })}
    >
      <span className="tabular-nums font-headline text-xs font-black leading-none text-foreground sm:text-sm" aria-hidden>
        {displaySeconds}
      </span>
      <div className="h-1 w-[4.25rem] overflow-hidden rounded-full bg-muted/90 ring-1 ring-border/40 sm:w-[5rem]" aria-hidden>
        <div
          className={cn("h-full rounded-full transition-none", urgent ? "bg-destructive" : "bg-primary")}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function ChallengerAxisRevealLockCountdownInline({ seconds }: ChallengerAxisRevealLockCountdown) {
  const { t } = useTranslation("game");

  return (
    <div
      className="flex shrink-0 items-center gap-1 rounded-md border border-border/55 bg-muted/35 px-2 py-1 shadow-sm"
      role="timer"
      aria-label={t("challenge.revealLockCountdownSr", { seconds })}
    >
      <Icon name="lock" size={16} fill={1} className="shrink-0 text-primary" aria-hidden />
      <span className="tabular-nums font-headline text-xs font-black leading-none text-foreground sm:text-sm">
        {seconds}
        <span className="ml-0.5 text-[9px] font-semibold text-muted-foreground sm:text-[10px]">s</span>
      </span>
    </div>
  );
}

export function ChallengerAxisIdentityStrip({
  nickname,
  phase,
  isLocalPlayer,
  hint = null,
  challengeAxisDisplay = null,
  pickCountdown = null,
  revealLockCountdown = null,
  className,
}: ChallengerAxisIdentityStripProps) {
  const { t } = useTranslation("game");
  const displayName = nickname.trim() || DEFAULT_LOBBY_NICKNAME;
  const initial = displayName[0]?.toUpperCase() ?? "?";
  const labelSr = t("challenge.axisIdentityLabel");

  const axisBadgeLabel =
    challengeAxisDisplay === "wild"
      ? t("challenge.wrongSuit")
      : challengeAxisDisplay === "number"
        ? t("challenge.wrongNumber")
        : null;

  return (
    <div
      className={cn(
        "flex w-full shrink-0 items-center gap-2 rounded-md border px-2.5 py-2 sm:gap-2.5 sm:px-3 sm:py-2.5",
        phase === "lock"
          ? "border-primary/35 bg-gradient-to-r from-primary/10 via-primary/[0.05] to-muted/20"
          : "border-border/60 bg-muted/25",
        className,
      )}
      role="group"
      aria-label={hint ? `${labelSr}: ${displayName}. ${hint}` : `${labelSr}: ${displayName}`}
    >
      <span className="sr-only">
        {labelSr}
        {hint ? ` — ${hint}` : null}
      </span>

      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-primary/30 bg-primary/15 font-headline text-xs font-black text-foreground sm:h-10 sm:w-10 sm:text-sm"
        aria-hidden
      >
        {initial}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-headline text-sm font-black leading-tight text-foreground sm:text-base">
          {displayName}
        </p>
        {challengeAxisDisplay != null && axisBadgeLabel != null ? (
          <p className="mt-0.5 text-[11px] font-semibold leading-snug text-primary sm:text-xs">
            <span className="text-foreground/80">{t("challenge.axisChallengingStatus")}</span>
            <span className="mx-1 text-muted-foreground" aria-hidden>
              ·
            </span>
            <span>{axisBadgeLabel}</span>
          </p>
        ) : null}
      </div>

      {pickCountdown != null ? <ChallengerAxisPickCountdownInline {...pickCountdown} /> : null}
      {revealLockCountdown != null ? <ChallengerAxisRevealLockCountdownInline {...revealLockCountdown} /> : null}

      {isLocalPlayer ? (
        <span className="shrink-0 rounded-md border border-primary/35 bg-primary/12 px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-primary sm:text-[10px]">
          {t("seat.you")}
        </span>
      ) : null}
    </div>
  );
}
