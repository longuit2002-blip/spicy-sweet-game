import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import type { PlayedCard } from '@/shared/types/game';
import { SPICE_EMOJI, SPICE_LABEL } from '@/shared/types/game';

interface GameTableProps {
  playedCard: PlayedCard | null;
  currentPlayerName: string;
}

export function GameTable({ playedCard, currentPlayerName }: GameTableProps) {
  const { t } = useTranslation('game');

  return (
    <div className="flex flex-col items-center justify-center min-h-[200px] gap-4">
      <AnimatePresence mode="wait">
        {playedCard ? (
          <motion.div
            key="played"
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            className="flex flex-col items-center gap-3"
          >
            <div className="w-24 h-36 rounded-lg border-2 border-card-back bg-card-back flex items-center justify-center shadow-card">
              <span className="text-3xl opacity-40">🃏</span>
            </div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-muted rounded-lg px-4 py-2 text-center"
            >
              <p className="text-muted-foreground text-xs">{t('declare.preview')}</p>
              <p className="font-display text-lg text-foreground">
                {SPICE_EMOJI[playedCard.declaration.type]} {SPICE_LABEL[playedCard.declaration.type]}{' '}
                {playedCard.declaration.number}
              </p>
            </motion.div>
          </motion.div>
        ) : (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
            <div className="w-24 h-36 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center mb-3">
              <span className="text-muted-foreground/30 text-sm">{t('game.table.playHere')}</span>
            </div>
            <p className="text-muted-foreground text-sm">
              <span className="text-foreground font-semibold">{currentPlayerName}</span> {t('game.turn.isTurn')}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
