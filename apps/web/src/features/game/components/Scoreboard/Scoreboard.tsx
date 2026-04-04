import { motion } from "framer-motion";
import { computePlayerFinalScore, getPlayerScoreBreakdown } from "@sweet-spicy/game-logic";
import type { GamePlayer } from "@sweet-spicy/shared-types";
import { getPlayerHandCount, type Player } from "@/shared/types/game";
import { Button } from "@/components/ui/button";
import { useAnimatedNumber } from "@/hooks/useAnimatedNumber";
import { useModalVariants } from "@/hooks/useGameMotion";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { TROPHY_CARD_POINTS, WILD_CARD_PENALTY, WILD_CARD_POINTS, NORMAL_CARD_POINTS } from "@sweet-spicy/game-logic";

function scoreForPlayer(p: Player): number {
  if ("wonPileCount" in p) return p.score;
  return computePlayerFinalScore(p as GamePlayer);
}

function isFullGamePlayer(p: Player): p is GamePlayer {
  return "wonPile" in p && Array.isArray((p as GamePlayer).wonPile);
}

interface ScoreboardProps {
  players: Player[];
  winner: Player | null;
  winners: Player[];
  onPlayAgain: () => void;
  onLeave: () => void;
}

function AnimatedScore({ value, className }: { value: number; className?: string }) {
  const display = useAnimatedNumber(value, 0, true);
  return <span className={className}>{display}</span>;
}

export function Scoreboard({ players, winner, winners, onPlayAgain, onLeave }: ScoreboardProps) {
  const { t } = useTranslation("game");
  const modalVariants = useModalVariants();
  const sorted = [...players].sort((a, b) => scoreForPlayer(b) - scoreForPlayer(a));
  const topIds = new Set((winners.length > 0 ? winners : winner ? [winner] : []).map((p) => p.id));

  return (
    <motion.div
      variants={modalVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-md p-4"
    >
      <motion.div
        transition={{ type: "spring", stiffness: 300, damping: 24 }}
        className="game-glass-panel w-full max-w-md max-h-[min(88dvh,34rem)] overflow-y-auto rounded-3xl border-border/30 p-3 shadow-kawaii sm:max-h-[90vh] sm:p-6"
      >
        <h2 className="mb-1 bg-gradient-to-r from-primary to-[hsl(var(--primary-container))] bg-clip-text text-center text-xl font-bold text-transparent sm:text-2xl">
          {t("game.winner.title")}
        </h2>
        {winners.length > 1 ? (
          <p className="text-center text-xs text-foreground mb-4 sm:mb-6 sm:text-sm">
            🏆 {t("game.winner.tie")}:{" "}
            <span className="font-semibold">{winners.map((p) => p.nickname).join(", ")}</span>
          </p>
        ) : (
          winner && (
            <p className="text-center text-xs text-foreground mb-4 sm:mb-6 sm:text-sm">
              🏆 <span className="font-semibold">{winner.nickname}</span> {t("game.winner.wins")}!
            </p>
          )
        )}

        <div className="space-y-2 mb-4 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:space-y-3 sm:mb-6">
          {sorted.map((player, i) => (
            <motion.div
              key={player.id}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08, type: "spring", stiffness: 280, damping: 28 }}
              className={cn(
                "flex flex-col gap-1.5 rounded-2xl border p-2 sm:gap-2 sm:p-3",
                topIds.has(player.id) ? "border-primary/50 bg-primary/10 shadow-kawaii" : "border-border/35 bg-card/80",
              )}
            >
              <div className="flex items-center justify-between gap-1.5 sm:gap-2">
                <div className="flex items-center gap-2 min-w-0 sm:gap-3">
                  <span className="shrink-0 text-base text-muted-foreground sm:text-lg">
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate sm:text-sm">{player.nickname}</p>
                    <p className="text-[10px] text-muted-foreground sm:text-xs">
                      {t("game.winner.trophies")}:{" "}
                      {"trophyCount" in player ? player.trophyCount : 0} · {t("game.winner.cardsLeft")}:{" "}
                      {getPlayerHandCount(player)}
                    </p>
                  </div>
                </div>
                <AnimatedScore
                  value={scoreForPlayer(player)}
                  className="shrink-0 text-base font-semibold tabular-nums text-foreground sm:text-xl"
                />
              </div>
              {isFullGamePlayer(player) ? (
                <ScoreBreakdownDetail breakdown={getPlayerScoreBreakdown(player)} t={t} />
              ) : (
                <p className="border-l-2 border-border/35 pl-2 text-ui-caption text-muted-foreground">
                  {t("scoreboard.summaryClient", {
                    trophies: "trophyCount" in player ? player.trophyCount : 0,
                    pile: "wonPileCount" in player ? player.wonPileCount : 0,
                  })}
                </p>
              )}
            </motion.div>
          ))}
        </div>

        <div className="flex gap-2 sm:gap-3">
          <Button variant="outline" className="flex-1 rounded-full border-border/40 text-xs sm:text-sm" onClick={onLeave}>
            {t("game.winner.leave")}
          </Button>
          <Button variant="kawaii" className="flex-1 rounded-full text-xs sm:text-sm" onClick={onPlayAgain}>
            {t("game.winner.playAgain")} 🔥
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ScoreBreakdownDetail({
  breakdown,
  t,
}: {
  breakdown: ReturnType<typeof getPlayerScoreBreakdown>;
  t: (key: string, opts?: Record<string, string | number>) => string;
}) {
  return (
    <ul className="space-y-0.5 pl-2 text-ui-caption text-muted-foreground border-l-2 border-border/60">
      <li>
        {t("scoreboard.normalCards", { count: breakdown.normalCardsInPile, points: NORMAL_CARD_POINTS })}
      </li>
      <li>
        {t("scoreboard.wildCards", { count: breakdown.wildCardsInPile, points: WILD_CARD_POINTS })}
      </li>
      <li>
        {t("scoreboard.trophyCards", { count: breakdown.trophiesInPile, points: TROPHY_CARD_POINTS })}
      </li>
      <li className="text-foreground/90">
        {t("scoreboard.pileSubtotal", { value: breakdown.pilePoints })}
      </li>
      {breakdown.wildPenalty > 0 ? (
        <li className="text-destructive">
          {t("scoreboard.wildHandPenalty", { count: breakdown.wildCardsInHand, penalty: WILD_CARD_PENALTY })}
        </li>
      ) : null}
      <li className="font-semibold text-foreground pt-1">
        {t("scoreboard.total", { value: breakdown.total })}
      </li>
    </ul>
  );
}
