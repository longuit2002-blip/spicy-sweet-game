import { motion } from 'framer-motion';
import { memo } from 'react';
import type { GameCard, SpiceType } from '@/shared/types/game';
import { SPICE_EMOJI } from '@/shared/types/game';
import { cn } from '@/lib/utils';

interface SpiceCardProps {
  card: GameCard;
  faceDown?: boolean;
  selected?: boolean;
  onClick?: () => void;
  small?: boolean;
}

const spiceColorClass: Record<SpiceType, string> = {
  chili: 'card-chili',
  pepper: 'card-pepper',
  lemon: 'card-lemon',
};

export const SpiceCard = memo(function SpiceCard({
  card,
  faceDown,
  selected,
  onClick,
  small,
}: SpiceCardProps) {
  const size = small ? 'w-14 h-20 text-xs' : 'w-20 h-28 sm:w-24 sm:h-36 text-sm sm:text-base';

  if (faceDown) {
    return (
      <motion.div
        whileHover={onClick ? { y: -4 } : undefined}
        whileTap={onClick ? { scale: 0.95 } : undefined}
        onClick={onClick}
        className={cn(
          size,
          'rounded-lg border-2 border-card-back bg-card-back flex items-center justify-center cursor-default shadow-card select-none'
        )}
      >
        <span className="text-2xl opacity-40">🃏</span>
      </motion.div>
    );
  }

  return (
    <motion.div
      layout
      transition={{ type: 'spring', stiffness: 420, damping: 28 }}
      whileHover={onClick ? { y: -8, scale: 1.05 } : undefined}
      whileTap={onClick ? { scale: 0.95 } : undefined}
      onClick={onClick}
      className={cn(
        size,
        'rounded-lg border-2',
        spiceColorClass[card.type],
        'flex flex-col items-center justify-center gap-1 shadow-card select-none',
        onClick && 'cursor-pointer',
        !onClick && 'cursor-default',
        selected && 'ring-2 ring-primary ring-offset-2 ring-offset-background shadow-glow'
      )}
    >
      <span className={small ? 'text-lg' : 'text-2xl sm:text-3xl'}>{SPICE_EMOJI[card.type]}</span>
      <span className="font-bold text-foreground">{card.number}</span>
    </motion.div>
  );
});

