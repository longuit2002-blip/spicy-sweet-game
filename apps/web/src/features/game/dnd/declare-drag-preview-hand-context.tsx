"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { GameCard } from "@/shared/types/game";

const DeclareDragPreviewHandContext = createContext<readonly GameCard[]>([]);

export function DeclareDragPreviewHandProvider({
  cards,
  children,
}: {
  cards: readonly GameCard[];
  children: ReactNode;
}) {
  return (
    <DeclareDragPreviewHandContext.Provider value={cards}>{children}</DeclareDragPreviewHandContext.Provider>
  );
}

export function useDeclareDragPreviewHand(): readonly GameCard[] {
  return useContext(DeclareDragPreviewHandContext);
}
