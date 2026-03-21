import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import type { Declaration, SpiceType, GameCard } from '@/shared/types/game';
import { SPICE_EMOJI, SPICE_LABEL } from '@/shared/types/game';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { changeLanguage } from '@/lib/i18n';

interface DeclareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card: GameCard | null;
  onDeclare: (declaration: Declaration) => void;
}

const TYPES: SpiceType[] = ['chili', 'pepper', 'lemon'];
const NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export function DeclareDialog({ open, onOpenChange, card, onDeclare }: DeclareDialogProps) {
  const { t, i18n } = useTranslation('game');
  const [selectedType, setSelectedType] = useState<SpiceType | null>(null);
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null);

  useEffect(() => {
    if (open) {
      setSelectedType(null);
      setSelectedNumber(null);
    }
  }, [open]);

  const handleDeclare = () => {
    if (selectedType && selectedNumber) {
      onDeclare({ type: selectedType, number: selectedNumber });
    }
  };

  const handleClose = () => {
    setSelectedType(null);
    setSelectedNumber(null);
    onOpenChange(false);
  };

  const toggleLanguage = () => {
    const newLang = i18n.language === 'vi' ? 'en' : 'vi';
    changeLanguage(newLang);
  };

  if (!open) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
      onClick={handleClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="bg-card border border-border rounded-xl p-6 w-full max-w-sm shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg text-foreground text-center flex-1">{t('declare.title')}</h3>
          <Button variant="ghost" size="sm" onClick={toggleLanguage} className="text-xs h-7 px-2">
            {i18n.language === 'vi' ? '🇻🇳 EN' : '🇬🇧 VI'}
          </Button>
        </div>

        {card && (
          <div className="mb-4 p-3 bg-muted rounded-lg flex items-center gap-3">
            <div className="w-10 h-14 bg-primary/20 rounded flex items-center justify-center">
              <span className="text-xl">
                {SPICE_EMOJI[card.type]}
              </span>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('declare.selectedCard')}</p>
              <p className="text-sm font-medium">
                {SPICE_EMOJI[card.type]} {card.number}
              </p>
            </div>
          </div>
        )}

        <p className="text-muted-foreground text-sm mb-2">{t('declare.chooseType')}</p>
        <div className="flex gap-2 mb-4">
          {TYPES.map((type) => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={cn(
                'flex-1 py-3 rounded-lg border-2 text-center transition-all',
                selectedType === type
                  ? 'border-primary bg-primary/10 shadow-glow'
                  : 'border-border bg-muted hover:border-muted-foreground/40'
              )}
            >
              <span className="text-2xl">{SPICE_EMOJI[type]}</span>
              <p className="text-xs text-foreground mt-1">{t(`spice.${type}`)}</p>
            </button>
          ))}
        </div>

        <p className="text-muted-foreground text-sm mb-2">{t('declare.chooseNumber')}</p>
        <div className="grid grid-cols-5 gap-2 mb-6">
          {NUMBERS.map((num) => (
            <button
              key={num}
              onClick={() => setSelectedNumber(num)}
              className={cn(
                'py-2 rounded-lg border-2 font-bold transition-all',
                selectedNumber === num
                  ? 'border-primary bg-primary/10 text-primary shadow-glow'
                  : 'border-border bg-muted text-foreground hover:border-muted-foreground/40'
              )}
            >
              {num}
            </button>
          ))}
        </div>

        {selectedType && selectedNumber && (
          <div className="mb-4 p-3 bg-gradient-fire/10 rounded-lg text-center">
            <p className="text-xs text-muted-foreground mb-1">{t('declare.preview')}</p>
            <p className="text-lg font-bold">
              {SPICE_EMOJI[selectedType]} {selectedNumber}
            </p>
            <p className="text-xs text-muted-foreground">
              {t(`spice.${selectedType}`)} {selectedNumber}
            </p>
          </div>
        )}

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={handleClose}>
            {t('declare.cancel')}
          </Button>
          <Button
            className="flex-1 bg-gradient-fire text-primary-foreground"
            disabled={!selectedType || !selectedNumber}
            onClick={handleDeclare}
          >
            {t('declare.confirm')}{' '}
            {selectedType && selectedNumber ? `${SPICE_EMOJI[selectedType]} ${selectedNumber}` : ''}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

