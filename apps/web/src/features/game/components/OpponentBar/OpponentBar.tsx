import type { Player } from '@/shared/types/game';
import { useTranslation } from 'react-i18next';

interface OpponentBarProps {
  players: Player[];
  currentPlayerId: string;
  activePlayerIndex: number;
}

export function OpponentBar({ players, currentPlayerId, activePlayerIndex }: OpponentBarProps) {
  const { t } = useTranslation('common');
  const opponents = players.filter((p) => p.id !== currentPlayerId);

  return (
    <div className="flex justify-center gap-3 sm:gap-4 px-4 py-3">
      {opponents.map((player) => {
        const isActive = players[activePlayerIndex]?.id === player.id;
        return (
          <div
            key={player.id}
            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all ${
              isActive ? 'bg-primary/10 ring-1 ring-primary animate-pulse-glow' : 'bg-muted/50'
            }`}
          >
            <span className="text-sm font-semibold text-foreground truncate max-w-[80px]">
              {player.nickname}
            </span>
            <div className="flex gap-0.5">
              {player.hand.map((_, i) => (
                <div key={i} className="w-3 h-4 bg-card-back rounded-sm border border-border" />
              ))}
            </div>
            <span className="text-xs text-muted-foreground">⭐ {player.score}</span>
          </div>
        );
      })}
    </div>
  );
}
