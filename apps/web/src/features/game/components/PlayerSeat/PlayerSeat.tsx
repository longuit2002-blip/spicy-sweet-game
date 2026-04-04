"use client";

import { motion } from "framer-motion";
import type { GamePlayer } from "@sweet-spicy/shared-types";
import { type Player } from "@/shared/types/game";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useTranslation } from "react-i18next";
import { playerPresenceStats } from "@/features/game/lib/player-presence-stats";

function wonPileCountFor(p: Player): number {
  if ("wonPileCount" in p && typeof p.wonPileCount === "number") return p.wonPileCount;
  return (p as GamePlayer).wonPile.length;
}

export interface PlayerSeatProps {
  player: Player;
  isActive: boolean;
  isLocal: boolean;
  compact?: boolean;
  /** Softer frame when shown beside the hand dock (table footer). */
  dock?: boolean;
  lastAction?: string | null;
  /** When set on the local seat, labels the won-pile zone for round-resolution VFX (not the hand). */
  wonPileAnchorId?: string;
}

export function PlayerSeat({
  player,
  isActive,
  isLocal,
  compact = false,
  dock = false,
  lastAction,
  wonPileAnchorId,
}: PlayerSeatProps) {
  const { t } = useTranslation("game");
  const { hand: handN, score, trophies } = playerPresenceStats(player);
  const won = wonPileCountFor(player);

  const avatar = (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full border-2 font-bold text-foreground",
        compact ? "h-9 w-9 text-xs" : "h-11 w-11 text-sm",
        isActive
          ? "border-primary bg-primary text-primary-foreground shadow-kawaii ring-2 ring-primary/35"
          : "border-border/50 bg-muted/90",
      )}
      aria-hidden
    >
      {player.nickname[0]?.toUpperCase() ?? "?"}
    </div>
  );

  const details = !compact ? (
    <>
      <div className="mt-0.5 flex flex-wrap justify-center gap-0.5">
        {Array.from({ length: Math.min(handN, 8) }).map((_, i) => (
          <div key={i} className="h-3 w-2 rounded-sm border border-border bg-card-back" />
        ))}
        {handN > 8 ? <span className="text-ui-tiny text-muted-foreground">+{handN - 8}</span> : null}
      </div>
      <div className="mt-1 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 text-ui-micro text-muted-foreground">
        <span title={t("seat.wonPileHint")} id={isLocal && wonPileAnchorId ? wonPileAnchorId : undefined}>
          {t("seat.wonPile")}: <strong className="text-foreground tabular-nums">{won}</strong>
        </span>
        <span aria-hidden>·</span>
        <span>
          🏆 <strong className="text-foreground tabular-nums">{trophies}</strong>
        </span>
      </div>
      <span className="mt-0.5 block text-ui-micro text-muted-foreground">
        ⭐ <span className="tabular-nums text-foreground">{score}</span>
      </span>
    </>
  ) : dock && isActive ? (
    <div
      className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5"
      aria-label={t("challenge.contextChipStats", { hand: handN, score, trophies })}
    >
      <div className="flex gap-0.5" aria-hidden>
        {Array.from({ length: Math.min(handN, 5) }).map((_, i) => (
          <div key={i} className="h-2 w-1.5 rounded-sm border border-border bg-card-back" />
        ))}
        {handN > 5 ? <span className="text-ui-tiny text-muted-foreground">+{handN - 5}</span> : null}
      </div>
      <span className="text-ui-tiny tabular-nums text-muted-foreground">
        ⭐ <strong className="text-foreground">{score}</strong>
      </span>
      <span className="text-ui-tiny tabular-nums text-muted-foreground">
        🏆 <strong className="text-foreground">{trophies}</strong>
      </span>
    </div>
  ) : (
    <div className="mt-0.5 flex gap-0.5">
      {Array.from({ length: Math.min(handN, 5) }).map((_, i) => (
        <div key={i} className="h-2 w-1.5 rounded-sm border border-border bg-card-back" />
      ))}
      {handN > 5 ? <span className="text-ui-tiny text-muted-foreground">+</span> : null}
    </div>
  );

  const nameLine = (
    <p className="truncate text-ui-caption font-semibold text-foreground sm:text-xs">
      {player.nickname}
      {isLocal ? ` · ${t("seat.you")}` : ""}
    </p>
  );

  const actionLine =
    lastAction != null && lastAction.length > 0 ? (
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="mt-1 max-w-full truncate rounded bg-primary/15 px-1.5 py-0.5 text-ui-tiny font-medium text-primary"
      >
        {lastAction}
      </motion.p>
    ) : null;

  if (compact) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <motion.button
            type="button"
            layout
            className={cn(
              "flex h-12 min-w-[100px] max-w-[128px] shrink-0 items-center gap-2 rounded-2xl border px-2 py-1 text-left transition-colors sm:h-14 sm:min-w-[120px] sm:max-w-[140px]",
              dock && "rounded-xl border-border/25 bg-transparent shadow-none",
              isActive
                ? dock
                  ? "border-primary/45 bg-primary/12 shadow-kawaii ring-2 ring-primary/35 ring-offset-2 ring-offset-background"
                  : "border-primary/50 bg-primary/12 shadow-kawaii ring-2 ring-primary/35"
                : dock
                  ? "border-border/25 bg-transparent"
                  : "border-border/35 bg-card/80",
            )}
          >
            {avatar}
            <div className="min-w-0 max-w-[64px] sm:max-w-[72px]">
              {nameLine}
              {details}
              {isLocal && wonPileAnchorId ? (
                <span
                  id={wonPileAnchorId}
                  className="mt-0.5 block text-ui-tiny tabular-nums text-muted-foreground"
                  title={t("seat.wonPileHint")}
                >
                  {t("seat.wonPile")}: <strong className="text-foreground">{won}</strong>
                </span>
              ) : null}
              {actionLine}
            </div>
          </motion.button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-3 text-sm" align="start">
          <p className="font-semibold">{player.nickname}</p>
          <ul className="mt-2 space-y-1 text-muted-foreground">
            <li>
              {t("seat.handCards")}: <strong className="text-foreground">{handN}</strong>
            </li>
            <li>
              {t("seat.wonPile")}: <strong className="text-foreground">{won}</strong>
            </li>
            <li>
              {t("game.winner.trophies")}: <strong className="text-foreground">{trophies}</strong>
            </li>
            <li>
              {t("seat.runningScore")}: <strong className="text-foreground">{score}</strong>
            </li>
          </ul>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <motion.div
      layout
      className={cn(
        "flex flex-col items-center gap-1 border px-3 py-2",
        dock ? "rounded-xl border-border/20 bg-transparent shadow-none" : "rounded-2xl",
        isActive
          ? dock
            ? "border-primary/45 bg-primary/12 shadow-kawaii ring-2 ring-primary/35 ring-offset-2 ring-offset-background"
            : "border-primary/50 bg-primary/12 shadow-kawaii ring-2 ring-primary/35"
          : dock
            ? "border-border/20 bg-transparent"
            : "border-border/35 bg-card/85",
      )}
    >
      {avatar}
      <div className="flex flex-col items-center text-center">
        <div className="max-w-[88px] sm:max-w-[100px]">{nameLine}</div>
        {details}
        {actionLine}
      </div>
    </motion.div>
  );
}
