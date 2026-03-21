import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { PlayedCard, Player, SPICE_EMOJI, SPICE_LABEL } from '@/lib/types';
import { Button } from '@/components/ui/button';

interface ChallengePhaseProps {
  playedCard: PlayedCard;
  players: Player[];
  currentPlayerId: string;
  onChallenge: (challengerId: string) => void;
  onAccept: () => void;
  timerSeconds: number;
}

export function ChallengePhase({
  playedCard,
  players,
  currentPlayerId,
  onChallenge,
  onAccept,
  timerSeconds,
}: ChallengePhaseProps) {
  const { t } = useTranslation('game');
  const [timeLeft, setTimeLeft] = useState(timerSeconds);
  const [challengerIndex, setChallengerIndex] = useState(0);

  // Find non-current players for challenge rotation
  const otherPlayers = players.filter((p) => p.id !== playedCard.playerId);

  useEffect(() => {
    if (timeLeft <= 0) {
      // Auto-accept when timer runs out
      if (challengerIndex >= otherPlayers.length - 1) {
        onAccept();
      } else {
        setChallengerIndex((i) => i + 1);
        setTimeLeft(timerSeconds);
      }
      return;
    }
    const timer = setInterval(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, challengerIndex, otherPlayers.length, onAccept, timerSeconds]);

  const currentChallenger = otherPlayers[challengerIndex];
  const playerWhoPlayed = players.find((p) => p.id === playedCard.playerId);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
    >
      <div className="bg-card border border-border rounded-xl p-6 w-full max-w-sm shadow-card text-center">
        <p className="text-muted-foreground text-sm mb-1">
          {playerWhoPlayed?.nickname} {t('challenge.title')}:
        </p>
        <p className="font-display text-2xl text-foreground mb-4">
          {SPICE_EMOJI[playedCard.declaration.type]} {SPICE_LABEL[playedCard.declaration.type]} {playedCard.declaration.number}
        </p>

        {/* Timer */}
        <div className="mb-4">
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${timeLeft <= 3 ? 'bg-destructive' : 'bg-gradient-fire'}`}
              initial={{ width: '100%' }}
              animate={{
                width: `${(timeLeft / timerSeconds) * 100}%`,
                scale: timeLeft <= 3 ? [1, 1.05, 1] : 1,
              }}
              transition={{ duration: 0.3 }}
            />
          </div>
          <p className={`text-xs mt-1 ${timeLeft <= 3 ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}>
            {t('challenge.timeLeft', { seconds: timeLeft })}
          </p>
        </div>

        <p className="text-foreground font-semibold mb-4">
          {t('challenge.playerChallenge', { player: currentChallenger?.nickname })}
        </p>

        <div className="flex gap-3">
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex-1"
          >
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                if (challengerIndex >= otherPlayers.length - 1) {
                  onAccept();
                } else {
                  setChallengerIndex((i) => i + 1);
                  setTimeLeft(timerSeconds);
                }
              }}
            >
              {t('challenge.accept')} ✓
            </Button>
          </motion.div>
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex-1"
          >
            <Button
              className="w-full bg-destructive text-destructive-foreground"
              onClick={() => onChallenge(currentChallenger.id)}
            >
              {t('challenge.challenge')} 🔥
            </Button>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
