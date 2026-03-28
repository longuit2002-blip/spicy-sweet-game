"use client";

import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import type { GamePlayer, ClientGamePlayer } from "@/shared/types/game";
import { DEFAULT_ROOM_MAX_PLAYERS } from "@/lib/game-room.constants";
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
  onAddBot: () => void;
  onStartGame: () => void;
  onToggleReady: () => void;
}

export function LobbyView({
  players,
  localPlayer,
  displayCode,
  isConnected,
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
      {/* Dot pattern background */}
      <div className="absolute inset-0 bg-pattern pointer-events-none" aria-hidden />

      <div className="max-w-4xl mx-auto relative z-10">
        {/* Title */}
        <div className="text-center mb-12">
          <h1 className="font-headline font-extrabold text-4xl md:text-6xl text-primary mb-2 italic tracking-tight">
            Spicy Neko Party
          </h1>
          <p className="font-label text-muted-foreground tracking-wider uppercase text-xs font-bold">
            {t("lobby.roomCode")}: <span className="text-secondary">{displayCode}</span>
            &nbsp;&bull;&nbsp;{t("lobby.title")}
          </p>
        </div>

        {/* Player grid */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {players.map((player, index) => (
            <motion.div
              key={player.id}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: index * 0.1 }}
              className={cn(
                LOBBY_SLOT_SHELL,
                "cursor-default justify-between border-b-4 border-primary-container bg-surface-container-low shadow-sm transition-transform hover:-translate-y-1",
              )}
            >
              <div className="relative flex shrink-0 flex-col items-center pt-1">
                <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-primary bg-surface-container-lowest shadow-inner sm:h-24 sm:w-24">
                  <span className="text-3xl font-bold text-primary sm:text-4xl">
                    {player.nickname[0]?.toUpperCase()}
                  </span>
                </div>
                {player.isHost && (
                  <div className="absolute -bottom-1 -right-1 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase tracking-tighter text-white sm:-bottom-2 sm:-right-2 sm:px-3 sm:py-1 sm:text-xs">
                    HOST
                  </div>
                )}
              </div>
              <div className="w-full shrink-0 text-center">
                <p className="font-headline text-base font-bold leading-tight sm:text-lg">{player.nickname}</p>
                <p
                  className={cn(
                    "mt-1 text-[10px] font-bold uppercase sm:text-xs",
                    player.isReady ? "text-secondary" : "text-muted-foreground",
                  )}
                >
                  {player.isReady ? t("lobby.ready") : t("lobby.waiting")}
                </p>
              </div>
            </motion.div>
          ))}

          {/* Empty slots */}
          {players.length < DEFAULT_ROOM_MAX_PLAYERS &&
            Array.from({ length: DEFAULT_ROOM_MAX_PLAYERS - players.length }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className={cn(
                  LOBBY_SLOT_SHELL,
                  "justify-center gap-3 border-2 border-dashed border-outline-variant bg-surface-container-low/50 opacity-60 sm:gap-4",
                )}
              >
                <Icon name="add_circle" size={40} className="shrink-0 text-outline-variant" />
                <p className="px-1 text-center font-headline text-xs font-bold uppercase tracking-widest text-outline-variant sm:text-sm">
                  {t("lobby.inviteFriend")}
                </p>
              </div>
            ))}
        </div>

        {/* Ready / Start */}
        <div className="flex flex-col items-center gap-12">
          {localPlayer && (
            <Button
              type="button"
              variant="kawaii"
              className="cartoon-button-shadow animate-kawaii-bounce px-16 py-8 text-3xl font-headline font-black rounded-full border-[6px] border-primary-container bg-gradient-kawaii-cta text-white"
              onClick={onToggleReady}
            >
              <span className="flex items-center gap-4">
                {localPlayer.isReady ? t("lobby.cancelReady") : t("lobby.ready")}
                <Icon name="play_circle" size={40} fill={1} />
              </span>
            </Button>
          )}

          <div className="flex flex-wrap gap-3 justify-center">
            <Button
              variant="outline"
              className="rounded-full border-border/50 bg-card/80"
              onClick={onAddBot}
              disabled={players.length >= DEFAULT_ROOM_MAX_PLAYERS || isConnected}
            >
              {t("lobby.addBot")}
            </Button>
            <Button
              variant="kawaii"
              className="cartoon-button-shadow rounded-full px-8"
              onClick={onStartGame}
              disabled={!canStart}
              title={isConnected && !isHost ? t("lobby.hostStartsOnly") : undefined}
            >
              {t("lobby.startGame")}
            </Button>
          </div>

          {/* Status bar */}
          <div className="flex items-center gap-8 text-muted-foreground pb-8">
            <div className="flex items-center gap-2">
              <Icon name="verified" size={20} className="text-secondary" />
              <span className="text-xs font-bold uppercase tracking-tight">
                {players.length}/{DEFAULT_ROOM_MAX_PLAYERS} Players
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Icon name="wifi" size={20} className="text-secondary" />
              <span className="text-xs font-bold uppercase tracking-tight">24ms Ping</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
