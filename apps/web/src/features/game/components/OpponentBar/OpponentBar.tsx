import { PlayerSeat } from "@/features/game/components/PlayerSeat/PlayerSeat";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";
import type { Player } from "@/shared/types/game";

interface OpponentBarProps {
  players: Player[];
  currentPlayerId: string;
  activePlayerIndex: number;
  /** Per-opponent short status line (e.g. last action). */
  lastActionByPlayerId?: Readonly<Record<string, string>>;
}

export function OpponentBar({ players, currentPlayerId, activePlayerIndex, lastActionByPlayerId }: OpponentBarProps) {
  const opponents = players.filter((p) => p.id !== currentPlayerId);
  const compact = useMediaQuery("(max-width: 767px)");

  return (
    <div
      className={cn(
        "flex justify-center gap-2 px-2 py-2 sm:gap-3 sm:px-4 sm:py-3",
        compact && opponents.length >= 3 && "snap-x snap-mandatory overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
      )}
    >
      {opponents.map((player) => {
        const isActive = players[activePlayerIndex]?.id === player.id;
        return (
          <div key={player.id} className={cn(compact && "shrink-0 snap-start")}>
            <PlayerSeat
              player={player}
              isActive={isActive}
              isLocal={false}
              compact={compact}
              lastAction={lastActionByPlayerId?.[player.id]}
            />
          </div>
        );
      })}
    </div>
  );
}
