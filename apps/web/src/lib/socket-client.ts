"use client";

import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "@sweet-spicy/shared-types";

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const SOCKET_URL =
  typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:3001")
    : "http://localhost:3001";

let socketInstance: GameSocket | null = null;
let socketToken: string | null = null;
let pendingDisconnectTimer: ReturnType<typeof setTimeout> | null = null;

const RECONNECTION_DELAY_MS = 1000;
const RECONNECTION_DELAY_MAX_MS = 5000;
const MAX_RECONNECTION_ATTEMPTS = 10;
const REQUEST_TIMEOUT_MS = 10000;
const SOCKET_DISCONNECT_GRACE_MS = 150;

function clearPendingDisconnect(): void {
  if (pendingDisconnectTimer) {
    clearTimeout(pendingDisconnectTimer);
    pendingDisconnectTimer = null;
  }
}

export function createSocket(token?: string): GameSocket {
  const nextToken = token ?? null;
  clearPendingDisconnect();

  if (socketInstance) {
    if (socketToken === nextToken) {
      socketInstance.auth = nextToken ? { token: nextToken } : {};
      if (!socketInstance.connected && !socketInstance.active) {
        socketInstance.connect();
      }
      return socketInstance;
    }

    socketInstance.disconnect();
    socketInstance = null;
  }

  socketToken = nextToken;
  socketInstance = io(SOCKET_URL, {
    auth: nextToken ? { token: nextToken } : undefined,
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
  clearPendingDisconnect();

  const activeSocket = socketInstance;
  const activeToken = socketToken;

  if (!activeSocket) {
    return;
  }

  pendingDisconnectTimer = setTimeout(() => {
    if (socketInstance !== activeSocket || socketToken !== activeToken) {
      return;
    }

    activeSocket.disconnect();
    socketInstance = null;
    socketToken = null;
    pendingDisconnectTimer = null;
  }, SOCKET_DISCONNECT_GRACE_MS);
}

export function isSocketConnected(): boolean {
  return socketInstance?.connected ?? false;
}
