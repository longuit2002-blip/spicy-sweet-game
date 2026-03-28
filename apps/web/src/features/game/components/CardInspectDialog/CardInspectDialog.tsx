"use client";

import { useTranslation } from "react-i18next";
import type { GameCard } from "@/shared/types/game";
import { SpiceCard } from "@/features/game/components/SpiceCard";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface CardInspectDialogProps {
  card: GameCard | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Select this card for play (opens declare flow in parent). */
  onChooseToPlay: () => void;
  /** When false, hide play CTA (e.g. not your turn). */
  canChooseToPlay?: boolean;
}

export function CardInspectDialog({
  card,
  open,
  onOpenChange,
  onChooseToPlay,
  canChooseToPlay = true,
}: CardInspectDialogProps) {
  const { t } = useTranslation("game");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-border/60 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("hand.cardDetailTitle")}</DialogTitle>
          <DialogDescription>{t("hand.cardDetailHint")}</DialogDescription>
        </DialogHeader>
        <div className="flex justify-center py-2">
          {card ? (
            <div
              className={cn(
                "flex items-center justify-center",
                "scale-[1.35] sm:scale-[1.55]",
                "origin-center",
              )}
            >
              <SpiceCard card={card} />
            </div>
          ) : null}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" className="rounded-full" onClick={() => onOpenChange(false)}>
            {t("declare.cancel")}
          </Button>
          {canChooseToPlay ? (
            <Button
              type="button"
              variant="kawaii"
              className="cartoon-button-shadow rounded-full px-6"
              onClick={() => {
                onChooseToPlay();
                onOpenChange(false);
              }}
            >
              {t("hand.playThisCard")}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
