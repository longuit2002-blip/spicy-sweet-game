import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { ChallengeResult, Player, SPICE_EMOJI, SPICE_LABEL } from '@/lib/types';
import { SpiceCard } from './SpiceCard';
import { Button } from '@/components/ui/button';

interface RevealResultProps {
  result: ChallengeResult;
  players: Player[];
  onContinue: () => void;
}

export function RevealResult({ result, players, onContinue }: RevealResultProps) {
  const { t } = useTranslation(['game', 'common']);
  const challenger = players.find((p) => p.id === result.challengerId);
  const player = players.find((p) => p.id === result.playerId);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
    >
      <motion.div
        initial={{ scale: 0.8, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className="bg-card border border-border rounded-xl p-6 w-full max-w-sm shadow-card text-center"
      >
        {/* Card flip reveal */}
        <motion.div
          initial={{ rotateY: 180 }}
          animate={{ rotateY: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="flex justify-center mb-4"
        >
          <SpiceCard card={result.realCard} />
        </motion.div>

        <p className="text-muted-foreground text-sm mb-1">
          {t('declare.preview')} {SPICE_EMOJI[result.declaredCard.type]} {SPICE_LABEL[result.declaredCard.type]} {result.declaredCard.number}
        </p>
        <p className="text-muted-foreground text-sm mb-4">
          {t('result.realCard')}: {SPICE_EMOJI[result.realCard.type]} {SPICE_LABEL[result.realCard.type]} {result.realCard.number}
        </p>

        {result.wasBluff ? (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.4, type: 'spring' }}
          >
            <p className="font-display text-2xl text-destructive mb-2">{t('challenge.bluffCaught')} 🔥</p>
            <p className="text-foreground">
              <span className="font-semibold">{player?.nickname}</span> {t('result.wasBluff')}
              <br />
              <span className="font-semibold">{challenger?.nickname}</span> {t('result.challengerWins')}
            </p>
            <p className="text-muted-foreground text-sm mt-2">
              {t('result.penalty', { player: player?.nickname })}
            </p>
          </motion.div>
        ) : (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.4, type: 'spring' }}
          >
            <p className="font-display text-2xl text-secondary mb-2">{t('result.wasTruth')} ✨</p>
            <p className="text-foreground">
              <span className="font-semibold">{player?.nickname}</span> {t('result.wasTruthMessage')}
              <br />
              <span className="font-semibold">{challenger?.nickname}</span> {t('result.challengerLoses')}
            </p>
            <p className="text-muted-foreground text-sm mt-2">
              {t('result.penalty', { player: challenger?.nickname })}
            </p>
          </motion.div>
        )}

        <Button className="mt-6 bg-gradient-fire text-primary-foreground w-full" onClick={onContinue}>
          {t('common.continue')}
        </Button>
      </motion.div>
    </motion.div>
  );
}
