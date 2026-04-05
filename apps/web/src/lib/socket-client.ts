"use client";

import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "@sweet-spicy/shared-types";

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const SOCKET_URL =
  typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:3001")
    : "http://localhost:3001";

// #region agent log
/** Debug NDJSON ingest (same machine as browser + Cursor debug server). */
function agentSocketDebug(
  hypothesisId: string,
  location: string,
  message: string,
  data: Record<string, unknown>,
): void {
  if (typeof window === "undefined") {
    return;
  }
  fetch("http://127.0.0.1:7441/ingest/dfeb2aae-d72a-4d3e-9028-a1269ee253e7", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "6201b8" },
    body: JSON.stringify({
      sessionId: "6201b8",
      hypothesisId,
      location,
      message,
      data,
      timestamp: Date.now(),
      runId: "pre-fix",
    }),
  }).catch(() => {});
}
// #endregion

/** Structured log for production debugging (browser console). */
function logSocketConnectError(error: unknown): void {
  if (typeof window === "undefined") {
    return;
  }
  const pageOrigin = window.location.origin;
  const base = { socketUrl: SOCKET_URL, pageOrigin };
  let transport = "unknown";
  if (socketInstance?.io?.engine && typeof socketInstance.io.engine.transport?.name === "string") {
    transport = socketInstance.io.engine.transport.name;
  }
  if (error instanceof Error) {
    const ext = error as Error & {
      description?: string;
      context?: unknown;
      type?: string;
    };
    // #region agent log
    agentSocketDebug("B", "socket-client:connect_error", "connect_error", {
      ...base,
      transport,
      message: ext.message,
      errType: ext.type ?? ext.name,
    });
    // #endregion
    console.error("[sweet-spicy][socket] connect_error", {
      ...base,
      message: ext.message,
      name: ext.name,
      description: ext.description,
      type: ext.type,
      cause: ext.cause,
    });
    return;
  }
  // #region agent log
  agentSocketDebug("B", "socket-client:connect_error", "connect_error_non_error", { ...base, transport });
  // #endregion
  console.error("[sweet-spicy][socket] connect_error", { ...base, error });
}

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

  socketInstance.on("connect_error", logSocketConnectError);

  // #region agent log
  {
    const engine = socketInstance.io?.engine;
    agentSocketDebug("A", "socket-client:createSocket", "socket_instantiated", {
      SOCKET_URL,
      pageOrigin: typeof window !== "undefined" ? window.location.origin : "",
      transportsOption: "websocket,polling",
    });
    engine?.once("open", () => {
      agentSocketDebug("D", "socket-client:engine_open", "engine_open", {
        transport: engine.transport?.name ?? "unknown",
      });
    });
    engine?.on("upgrade", () => {
      agentSocketDebug("C", "socket-client:engine_upgrade", "upgrade_ok", {
        transport: engine.transport?.name ?? "unknown",
      });
    });
    engine?.on("upgradeError", (err: unknown) => {
      agentSocketDebug("C", "socket-client:engine_upgradeError", "upgrade_failed", {
        err: err instanceof Error ? err.message : String(err),
        transport: engine.transport?.name ?? "unknown",
      });
    });
  }
  socketInstance.once("connect", () => {
    const engine = socketInstance?.io?.engine;
    agentSocketDebug("D", "socket-client:connect", "socket_connected", {
      transport: engine?.transport?.name ?? "unknown",
    });
  });
  // #endregion

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
