"use client";

import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import type { GamePlayer, ClientGamePlayer } from "@/shared/types/game";
import { cn } from "@/lib/utils";

type LobbyPlayer = GamePlayer | ClientGamePlayer;

/** Same footprint for occupied + empty slots so every grid cell matches (avoids short all-empty rows). */
const LOBBY_SLOT_SHELL =
  "flex aspect-square w-full flex-col items-center rounded-xl p-5 sm:p-6";

interface LobbyViewProps {
  players: readonly LobbyPlayer[];
  localPlayer: LobbyPlayer | undefined;
  displayCode: string;
  isConnected: boolean;
  /** True while `/room/new` is waiting for `room:create` ack. */
  isCreatingRoom?: boolean;
  /** Server-aligned cap (from `room:joined`); use for slots + counts. */
  roomMaxPlayers: number;
  /** Host, capacity, and sync gates from parent (online vs offline). */
  canAddBot: boolean;
  onAddBot: () => void;
  onStartGame: () => void;
  onToggleReady: () => void;
}

export function LobbyView({
  players,
  localPlayer,
  displayCode,
  isConnected,
  isCreatingRoom = false,
  roomMaxPlayers,
  canAddBot,
  onAddBot,
  onStartGame,
  onToggleReady,
}: LobbyViewProps) {
  const { t } = useTranslation("game");

  const allReady = players.every((p) => p.isReady);
  const isHost = localPlayer?.isHost ?? false;
  const canStart =
    players.length >= 2 &&
    allReady &&
    (!isConnected || isHost);

  return (
    <div className="relative flex-grow overflow-y-auto custom-scrollbar px-6 py-8">
      <div className="absolute inset-0 bg-pattern pointer-events-none" aria-hidden />

      <div className="max-w-4xl mx-auto relative z-10">
        {isCreatingRoom ? (
          <div
            className={cn(
              "mb-8 flex items-center justify-center gap-3 rounded-2xl border border-primary/20",
              "bg-primary/5 px-4 py-3 text-sm font-semibold text-primary",
            )}
            role="status"
            aria-live="polite"
          >
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
            {t("room.creatingRoomBanner")}
          </div>
        ) : null}

        <div className="text-center mb-10 md:mb-12">
          <h1 className="font-headline font-extrabold text-3xl md:text-5xl text-primary mb-3 italic tracking-tight leading-tight">
            Spicy Neko Party
          </h1>
          <p className="font-label text-ui-caption font-bold uppercase tracking-wider text-muted-foreground md:text-xs max-w-xl mx-auto">
            {t("lobby.roomCode")}: <span className="text-secondary">{displayCode}</span>
            <span className="text-muted-foreground/80">&nbsp;&bull;&nbsp;</span>
            {t("lobby.title")}
          </p>
          {isConnected ? (
            <p className="mt-2 text-ui-micro font-bold uppercase tracking-widest text-secondary">
              {t("lobby.onlineConnected")}
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-12 md:mb-14">
          {players.map((player, index) => (
            <motion.div
              key={player.id}
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: index * 0.08 }}
              className={cn(
                LOBBY_SLOT_SHELL,
                "cursor-default justify-between border-b-4 border-primary-container bg-surface-container-low shadow-sm transition-transform hover:-translate-y-0.5",
              )}
            >
              <div className="relative flex shrink-0 flex-col items-center pt-1">
                <div className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-primary bg-surface-container-lowest shadow-inner sm:h-24 sm:w-24">
                  <span className="text-xl font-bold text-primary sm:text-4xl">
                    {player.nickname[0]?.toUpperCase()}
                  </span>
                </div>
                {player.isHost ? (
                  <div className="absolute -bottom-1 -right-1 rounded-full bg-secondary px-2 py-0.5 text-ui-micro font-bold uppercase tracking-tighter text-secondary-foreground sm:-bottom-2 sm:-right-2 sm:px-3 sm:py-1 sm:text-xs">
                    HOST
                  </div>
                ) : null}
                {"isBot" in player && player.isBot ? (
                  <div className="absolute -bottom-1 -left-1 rounded-full bg-muted px-2 py-0.5 text-ui-micro font-bold uppercase tracking-tighter text-foreground sm:-bottom-2 sm:-left-2 sm:px-2.5 sm:text-ui-caption">
                    {t("lobby.botBadge")}
                  </div>
                ) : null}
              </div>
              <div className="flex min-h-[2.75rem] w-full shrink-0 flex-col justify-end text-center sm:min-h-[3rem]">
                <p className="font-headline text-sm font-bold leading-tight sm:text-lg line-clamp-2">
                  {player.nickname}
                </p>
                <p
                  className={cn(
                    "mt-1 text-ui-micro font-bold uppercase sm:text-xs",
                    player.isReady ? "text-secondary" : "text-muted-foreground",
                  )}
                >
                  {player.isReady ? t("lobby.ready") : t("lobby.waiting")}
                </p>
              </div>
            </motion.div>
          ))}

          {players.length < roomMaxPlayers &&
            Array.from({ length: roomMaxPlayers - players.length }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className={cn(
                  LOBBY_SLOT_SHELL,
                  "justify-center gap-2 border-2 border-dashed border-outline-variant bg-surface-container-low/50 opacity-70 sm:gap-3",
                )}
              >
                <Icon name="add_circle" size={36} className="shrink-0 text-outline-variant sm:h-10 sm:w-10" />
                <p className="px-1 text-center font-headline text-ui-micro font-bold uppercase tracking-widest text-outline-variant sm:text-sm">
                  {t("lobby.inviteFriend")}
                </p>
              </div>
            ))}
        </div>

        <div className="flex flex-col items-center gap-10 md:gap-12 max-w-lg mx-auto">
          {localPlayer ? (
            <Button
              type="button"
              variant="kawaii"
              className="cartoon-button-shadow w-full max-w-sm animate-kawaii-bounce px-10 py-7 text-2xl md:text-3xl font-headline font-black rounded-full border-[6px] border-primary-container bg-gradient-kawaii-cta text-white sm:max-w-none sm:px-16 sm:py-8"
              onClick={onToggleReady}
            >
              <span className="flex items-center justify-center gap-3 md:gap-4">
                {localPlayer.isReady ? t("lobby.cancelReady") : t("lobby.ready")}
                <Icon name="play_circle" size={36} fill={1} className="shrink-0 md:h-10 md:w-10" />
              </span>
            </Button>
          ) : null}

          <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
            <Button
              type="button"
              variant="outline"
              className="w-full rounded-full border-border/50 bg-card/80 sm:w-auto"
              onClick={onAddBot}
              disabled={!canAddBot}
              title={
                !canAddBot && localPlayer && !localPlayer.isHost
                  ? t("lobby.hostAddsBotsOnly")
                  : undefined
              }
            >
              {t("lobby.addBot")}
            </Button>
            <Button
              type="button"
              variant="kawaii"
              className="cartoon-button-shadow w-full rounded-full px-8 sm:w-auto"
              onClick={onStartGame}
              disabled={!canStart}
              title={isConnected && !isHost ? t("lobby.hostStartsOnly") : undefined}
            >
              {t("lobby.startGame")}
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-muted-foreground pb-6 md:pb-8">
            <div className="flex items-center gap-2">
              <Icon name="verified" size={18} className="text-secondary shrink-0" />
              <span className="text-ui-caption font-bold uppercase tracking-tight sm:text-xs">
                {t("lobby.playerCount", {
                  current: players.length,
                  max: roomMaxPlayers,
                })}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
