"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

const SocketReadyContext = createContext(false);

export function SocketReadyProvider({
  ready,
  children,
}: {
  ready: boolean;
  children: ReactNode;
}) {
  const v = useMemo(() => ready, [ready]);
  return <SocketReadyContext.Provider value={v}>{children}</SocketReadyContext.Provider>;
}

export function useSocketReady() {
  return useContext(SocketReadyContext);
}
