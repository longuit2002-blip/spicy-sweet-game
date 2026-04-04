"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { SidePanelSocial } from "@/features/social";

interface MobileChatSheetProps {
  open: boolean;
  onClose: () => void;
  onSendMessage: (message: string) => void;
  actionLogEntries?: readonly { id: string; text: string; at: number }[];
}

export function MobileChatSheet({
  open,
  onClose,
  onSendMessage,
  actionLogEntries = [],
}: MobileChatSheetProps) {
  const { t } = useTranslation("game");

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-background/50 backdrop-blur-[2px] xl:hidden"
            aria-label={t("chat.hide")}
            onClick={onClose}
          />
          <motion.aside
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="fixed inset-x-0 bottom-0 z-50 flex max-h-[min(70vh,520px)] flex-col overflow-hidden rounded-t-[1.5rem] border border-border/25 bg-card/95 shadow-kawaii backdrop-blur-xl sm:max-h-[min(75vh,600px)] sm:rounded-t-[1.75rem] xl:hidden"
          >
            <div className="flex items-center justify-between px-3 py-3 sm:px-4">
              <span className="text-sm font-semibold">{t("chat.title")}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onClose}
                aria-label={t("chat.hide")}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">
              <SidePanelSocial
                className="min-h-0"
                onSendMessage={onSendMessage}
                actionLogEntries={actionLogEntries}
              />
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
