import { motion, AnimatePresence } from 'framer-motion';
import { memo } from 'react';
import { GameCard } from '@/lib/types';
import { SpiceCard } from './SpiceCard';

interface PlayerHandProps {
  cards: GameCard[];
  selectedCardId: string | null;
  onSelectCard: (cardId: string) => void;
  disabled?: boolean;
}

export const PlayerHand = memo(function PlayerHand({ cards, selectedCardId, onSelectCard, disabled }: PlayerHandProps) {
  return (
    <div className="flex justify-center gap-2 sm:gap-3 overflow-x-auto pb-2 px-4">
      <AnimatePresence>
        {cards.map((card) => (
          <motion.div
            key={card.id}
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40, scale: 0.8 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          >
            <SpiceCard
              card={card}
              selected={selectedCardId === card.id}
              onClick={disabled ? undefined : () => onSelectCard(card.id)}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
});
