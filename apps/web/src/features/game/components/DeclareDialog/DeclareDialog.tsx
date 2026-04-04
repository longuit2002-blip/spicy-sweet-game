import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { MAX_DECLARATION_RANK } from '@sweet-spicy/game-logic';
import type { Declaration, SpiceType, GameCard } from '@/shared/types/game';
import { SPICE_EMOJI } from '@/shared/types/game';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
} from '@/components/ui/drawer';
import { cn } from '@/lib/utils';
import { changeLanguage } from '@/lib/i18n';
import { useIsMobile } from '@/hooks/use-mobile';

interface DeclareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card: GameCard | null;
  onDeclare: (declaration: Declaration) => void;
  /** When set, suit is locked for this round — UI fixes declaration to this spice. */
  lockedSuit?: SpiceType | null;
  /** Minimum rank allowed this turn (from last resolved play). */
  minDeclarationNumber?: number;
  /** Maximum rank allowed this turn (10 normally; 3 right after a resolved 10). */
  maxDeclarationNumber?: number;
}

const TYPES: SpiceType[] = ["chili", "lemon", "avocado"];
const NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/** Coerce prop (avoids `\"9\" + 1` → `\"91\"` from loose JSON / bad merges). */
function normalizeMinDeclaration(raw: number | undefined): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.floor(n));
}

function normalizeMaxDeclaration(raw: number | undefined, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(MAX_DECLARATION_RANK, Math.max(1, Math.floor(n)));
}

/* ------------------------------------------------------------------ */
/*  Shared inner content — rendered inside both modal and drawer      */
/* ------------------------------------------------------------------ */

interface DeclareDialogContentProps {
  card: GameCard | null;
  lockedSuit: SpiceType | null;
  selectedType: SpiceType | null;
  setSelectedType: (t: SpiceType) => void;
  selectedNumber: number | null;
  setSelectedNumber: (n: number) => void;
  allowedNumbers: number[];
  onDeclare: () => void;
  onClose: () => void;
  t: (key: string) => string;
  i18nLanguage: string;
  toggleLanguage: () => void;
}

function DeclareDialogContent({
  card,
  lockedSuit,
  selectedType,
  setSelectedType,
  selectedNumber,
  setSelectedNumber,
  allowedNumbers,
  onDeclare,
  onClose,
  t,
  i18nLanguage,
  toggleLanguage,
}: DeclareDialogContentProps) {
  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h3 className="flex-1 text-center text-lg font-semibold text-foreground">{t('declare.title')}</h3>
        <Button variant="ghost" size="sm" onClick={toggleLanguage} className="h-7 min-h-[44px] min-w-[44px] rounded-full px-2 text-xs">
          {i18nLanguage === 'vi' ? '🇻🇳 EN' : '🇬🇧 VI'}
        </Button>
      </div>

      {card && (
        <div className="mb-4 flex items-center gap-3 rounded-2xl bg-muted/80 p-3">
          <div className="flex h-14 w-10 items-center justify-center rounded-xl bg-primary/15">
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

      <p className="text-muted-foreground text-sm mb-2">{t("declare.chooseType")}</p>
      {lockedSuit != null ? (
        <div className="mb-4 rounded-2xl border-2 border-primary/40 bg-primary/10 p-3 text-center">
          <span className="text-2xl">{SPICE_EMOJI[lockedSuit]}</span>
          <p className="text-sm font-medium mt-1">{t(`spice.${lockedSuit}`)}</p>
          <p className="text-xs text-muted-foreground">{t("declare.lockedSuitHint")}</p>
        </div>
      ) : (
        <div className="flex gap-2 mb-4">
          {TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setSelectedType(type)}
              className={cn(
                "flex-1 rounded-2xl border-2 py-3 min-h-[44px] text-center transition-all",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background motion-safe:active:scale-[0.98]",
                selectedType === type
                  ? "border-primary bg-primary/12 shadow-kawaii"
                  : "border-border/40 bg-card/90 hover:border-muted-foreground/30",
              )}
            >
              <span className="text-2xl">{SPICE_EMOJI[type]}</span>
              <p className="text-xs text-foreground mt-1">{t(`spice.${type}`)}</p>
            </button>
          ))}
        </div>
      )}

      <p className="text-muted-foreground text-sm mb-2">{t('declare.chooseNumber')}</p>
      <div className="grid grid-cols-5 gap-2 mb-6">
        {allowedNumbers.map((num) => (
          <button
            key={num}
            onClick={() => setSelectedNumber(num)}
            className={cn(
              "rounded-xl border-2 py-2 min-h-[44px] min-w-[44px] font-bold transition-all",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background motion-safe:active:scale-[0.98]",
              selectedNumber === num
                ? "border-primary bg-primary/12 text-primary shadow-kawaii"
                : "border-border/40 bg-card/90 text-foreground hover:border-muted-foreground/30",
            )}
          >
            {num}
          </button>
        ))}
      </div>
      {allowedNumbers.length === 0 && (
        <p className="text-sm text-destructive mb-4 text-center">{t('declare.noValid')}</p>
      )}

      {selectedType && selectedNumber && (
        <div className="mb-4 rounded-2xl bg-primary/10 p-3 text-center">
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
        <Button variant="outline" className="flex-1 min-h-[44px] rounded-full border-border/40" onClick={onClose}>
          {t('declare.cancel')}
        </Button>
        <Button
          variant="kawaii"
          className="flex-1 min-h-[44px] rounded-full"
          disabled={!selectedType || !selectedNumber}
          onClick={onDeclare}
        >
          {t('declare.confirm')}{' '}
          {selectedType && selectedNumber ? `${SPICE_EMOJI[selectedType]} ${selectedNumber}` : ''}
        </Button>
      </div>
    </>
  );
}


/* ------------------------------------------------------------------ */
/*  Main component — switches between Drawer (mobile) and Modal       */
/* ------------------------------------------------------------------ */

export function DeclareDialog({
  open,
  onOpenChange,
  card,
  onDeclare,
  lockedSuit = null,
  minDeclarationNumber = 1,
  maxDeclarationNumber = MAX_DECLARATION_RANK,
}: DeclareDialogProps) {
  const { t, i18n } = useTranslation("game");
  const isMobile = useIsMobile();
  const [selectedType, setSelectedType] = useState<SpiceType | null>(null);
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null);

  const minDecl = normalizeMinDeclaration(minDeclarationNumber);
  const maxDecl = normalizeMaxDeclaration(maxDeclarationNumber, MAX_DECLARATION_RANK);
  const effectiveMax = Math.max(minDecl, Math.min(maxDecl, MAX_DECLARATION_RANK));
  const allowedNumbers = NUMBERS.filter((n) => n >= minDecl && n <= effectiveMax);

  useEffect(() => {
    if (open) {
      setSelectedType(lockedSuit ?? null);
      setSelectedNumber(null);
    }
  }, [open, minDecl, effectiveMax, lockedSuit]);

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

  const contentProps: DeclareDialogContentProps = {
    card,
    lockedSuit,
    selectedType,
    setSelectedType,
    selectedNumber,
    setSelectedNumber,
    allowedNumbers,
    onDeclare: handleDeclare,
    onClose: handleClose,
    t,
    i18nLanguage: i18n.language,
    toggleLanguage,
  };

  /* ---- Mobile: vaul Drawer bottom sheet ---- */
  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="game-glass-panel rounded-t-3xl border-t border-x border-border/80 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2">
          <DrawerTitle className="sr-only">{t('declare.title')}</DrawerTitle>
          <DeclareDialogContent {...contentProps} />
        </DrawerContent>
      </Drawer>
    );
  }

  /* ---- Desktop: centered modal (original) ---- */
  if (!open) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4 backdrop-blur-md"
      onClick={handleClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="game-glass-panel w-full max-w-sm rounded-3xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <DeclareDialogContent {...contentProps} />
      </motion.div>
    </motion.div>
  );
}
