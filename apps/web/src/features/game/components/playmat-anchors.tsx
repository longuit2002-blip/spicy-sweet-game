"use client";

import { createContext, useContext, useMemo, useRef, type ReactNode, type RefObject } from "react";

export type PlaymatAnchorContextValue = {
  drawStackRef: RefObject<HTMLDivElement | null>;
  roundPileRailRef: RefObject<HTMLDivElement | null>;
};

const PlaymatAnchorContext = createContext<PlaymatAnchorContextValue | null>(null);

export function PlaymatAnchorProvider({ children }: { children: ReactNode }) {
  const drawStackRef = useRef<HTMLDivElement | null>(null);
  const roundPileRailRef = useRef<HTMLDivElement | null>(null);
  const value = useMemo(
    () => ({
      drawStackRef,
      roundPileRailRef,
    }),
    [],
  );
  return <PlaymatAnchorContext.Provider value={value}>{children}</PlaymatAnchorContext.Provider>;
}

export function usePlaymatAnchors(): PlaymatAnchorContextValue {
  const v = useContext(PlaymatAnchorContext);
  if (!v) {
    throw new Error("usePlaymatAnchors must be used within PlaymatAnchorProvider");
  }
  return v;
}
