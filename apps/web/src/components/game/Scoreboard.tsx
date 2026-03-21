import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Player } from '@/lib/types';
import { Button } from '@/components/ui/button';

interface ScoreboardProps {
  players: Player[];
  winner: Player | null;
  onPlayAgain: () => void;
  onLeave: () => void;
}

export function Scoreboard({ players, winner, onPlayAgain, onLeave }: ScoreboardProps) {
  const { t } = useTranslation('game');
  const sorted = [...players].sort((a, b) => b.score - a.score);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-md p-4"
    >
      <motion.div
        initial={{ scale: 0.8, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className="bg-card border border-border rounded-xl p-6 w-full max-w-md shadow-card"
      >
        <h2 className="font-display text-2xl text-center text-gradient-fire mb-1">{t('game.winner.title')}</h2>
        {winner && (
          <p className="text-center text-foreground mb-6">
            🏆 <span className="font-semibold">{winner.nickname}</span> {t('game.winner.wins')}!
          </p>
        )}

        <div className="space-y-3 mb-6">
          {sorted.map((player, i) => (
            <motion.div
              key={player.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className={`flex items-center justify-between p-3 rounded-lg border ${
                i === 0 ? 'border-primary bg-primary/5' : 'border-border bg-muted/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="font-display text-lg text-muted-foreground">
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                </span>
                <div>
                  <p className="font-semibold text-foreground">{player.nickname}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('game.winner.bluffs')}: {player.successfulBluffs} · {t('game.winner.catches')}: {player.successfulChallenges} · {t('game.winner.cardsLeft')}: {player.hand.length}
                  </p>
                </div>
              </div>
              <span className="font-display text-xl text-foreground">{player.score}</span>
            </motion.div>
          ))}
        </div>

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onLeave}>
            {t('game.winner.leave')}
          </Button>
          <Button className="flex-1 bg-gradient-fire text-primary-foreground" onClick={onPlayAgain}>
            {t('game.winner.playAgain')} 🔥
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
