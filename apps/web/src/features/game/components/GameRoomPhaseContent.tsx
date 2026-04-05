"use client";

import { motion } from "framer-motion";
import { Trophy } from "lucide-react";
import type { TFunction } from "i18next";
import type { GameViewState } from "@/shared/types/game";
import { GAME_PHASE } from "@/shared/types/game";
import { Button } from "@/components/ui/button";
import { Scoreboard } from "@/features/game/components/Scoreboard";
import { SNAPPY_SPRING } from "@/features/game/animations";
import { REFILL_HAND_SIZE } from "@sweet-spicy/game-logic";

interface GameRoomPhaseContentProps {
  currentGameState: GameViewState;
  trophyDeclarerPlayer: GameViewState["players"][number] | null;
  t: TFunction;
  onLeaveRoom: () => void;
}

export function GameRoomPhaseContent({
  currentGameState,
  trophyDeclarerPlayer,
  t,
  onLeaveRoom,
}: GameRoomPhaseContentProps) {
  switch (currentGameState.phase) {
    case GAME_PHASE.REVEAL:
    case GAME_PHASE.SUPREME_RESOLVE:
    case GAME_PHASE.PENALTY:
    case GAME_PHASE.NEXT_TURN:
      return null;

    case GAME_PHASE.TROPHY_AWARDED:
      return (
        <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-2 px-2 text-center sm:gap-3 sm:px-4">
          <motion.div
            initial={{ scale: 0.6, rotate: -8 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={SNAPPY_SPRING}
            className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-trophy-gold/45 bg-trophy-gold/15 shadow-trophy-glow-soft sm:h-16 sm:w-16"
          >
            <Trophy className="h-9 w-9 text-trophy-gold" strokeWidth={1.75} aria-hidden />
          </motion.div>
          <div className="space-y-1">
            <p className="text-lg font-semibold text-foreground">{t("phase.trophyTitle")}</p>
            {trophyDeclarerPlayer ? (
              <p className="text-muted-foreground text-sm leading-relaxed">
                {t("phase.trophyBody", {
                  player: trophyDeclarerPlayer.nickname,
                  remaining: currentGameState.trophiesRemaining,
                })}
              </p>
            ) : (
              <p className="text-muted-foreground text-sm leading-relaxed">{t("phase.trophyAwarded")}</p>
            )}
            <p className="text-muted-foreground text-xs leading-relaxed">
              {t("phase.trophyRefill", { count: REFILL_HAND_SIZE })}
            </p>
          </div>
        </div>
      );

    case GAME_PHASE.END_GAME:
      return (
        <div className="px-4 text-center">
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="mb-6"
          >
            <h2 className="mb-2 text-4xl font-bold">{t("game.winner.endHeroTitle")}</h2>
            <p className="text-2xl">
              {currentGameState.winners.length > 1
                ? currentGameState.winners.map((player) => player.nickname).join(", ")
                : currentGameState.winner?.nickname}
            </p>
          </motion.div>

          <Scoreboard
            players={currentGameState.players}
            winner={currentGameState.winner}
            winners={currentGameState.winners}
            onPlayAgain={onLeaveRoom}
            onLeave={onLeaveRoom}
          />

          <Button
            variant="kawaii"
            className="cartoon-button-shadow mt-6 rounded-full px-10"
            onClick={onLeaveRoom}
          >
            {t("game.winner.playAgain")}
          </Button>
        </div>
      );

    default:
      return null;
  }
}
