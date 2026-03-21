"use client";

import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "@sweet-spicy/shared-types";

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const SOCKET_URL =
  typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:3001")
    : "http://localhost:3001";

let socketInstance: GameSocket | null = null;

const RECONNECTION_DELAY_MS = 1000;
const RECONNECTION_DELAY_MAX_MS = 5000;
const MAX_RECONNECTION_ATTEMPTS = 10;
const REQUEST_TIMEOUT_MS = 10000;

export function createSocket(token?: string): GameSocket {
  if (socketInstance) {
    socketInstance.disconnect();
  }

  socketInstance = io(SOCKET_URL, {
    auth: token ? { token } : undefined,
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: MAX_RECONNECTION_ATTEMPTS,
    reconnectionDelay: RECONNECTION_DELAY_MS,
    reconnectionDelayMax: RECONNECTION_DELAY_MAX_MS,
    timeout: REQUEST_TIMEOUT_MS,
  }) as GameSocket;

  return socketInstance;
}

export function getSocket(): GameSocket | null {
  return socketInstance;
}

export function disconnectSocket(): void {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
}

export function isSocketConnected(): boolean {
  return socketInstance?.connected ?? false;
}
