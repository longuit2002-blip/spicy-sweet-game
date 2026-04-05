"use client";

import { useEffect, useCallback, useMemo, useRef } from "react";
import { createSocket, getSocket, disconnectSocket } from "@/lib/socket-client";
import { useToast } from "@/hooks/use-toast";
import { refreshAccessToken, useUserStore } from "@/stores/userStore";
import type {
  AddLobbyBotResult,
  ChallengeType,
  ClientToServerEvents,
  CreateRoomResult,
  JoinResult,
  SocketActionResult,
} from "@sweet-spicy/shared-types";
import {
  DEFAULT_ROOM_MAX_PLAYERS,
  ROOM_CODE_MAX_LENGTH,
  ROOM_CODE_MIN_LENGTH,
  SOCKET_ERROR_CODE,
  SOCKET_ERROR_DETAIL_MESSAGE,
} from "@sweet-spicy/shared-types";
import { useRoomSessionStore } from "@/stores/room-session-store";

const SOCKET_ERROR_TOAST_DEDUPE_MS = 1500;

function normalizeJoinRoomCode(roomCode: string | null): string | null {
  if (!roomCode) {
    return null;
  }

  const normalizedRoomCode = roomCode.trim().toUpperCase();
  if (
    normalizedRoomCode.length < ROOM_CODE_MIN_LENGTH ||
    normalizedRoomCode.length > ROOM_CODE_MAX_LENGTH
  ) {
    return null;
  }

  return normalizedRoomCode;
}

function trimTrailingUndefined<TArgs extends readonly unknown[]>(args: TArgs): unknown[] {
  const trimmedArgs = [...args];
  while (trimmedArgs.length > 0 && trimmedArgs.at(-1) === undefined) {
    trimmedArgs.pop();
  }
  return trimmedArgs;
}

export function useGameSocket() {
  const { toast } = useToast();
  const accessToken = useUserStore((state) => state.accessToken);
  const isAuthenticated = useUserStore((state) => state.isAuthenticated);
  const applyRoomJoined = useRoomSessionStore((state) => state.applyRoomJoined);
  const applyPlayerJoined = useRoomSessionStore((state) => state.applyPlayerJoined);
  const applyPlayerLeft = useRoomSessionStore((state) => state.applyPlayerLeft);
  const applyPlayerReady = useRoomSessionStore((state) => state.applyPlayerReady);
  const applyHostChanged = useRoomSessionStore((state) => state.applyHostChanged);
  const applyGameState = useRoomSessionStore((state) => state.applyGameState);
  const setConnected = useRoomSessionStore((state) => state.setConnected);
  const resetSessionState = useRoomSessionStore((state) => state.reset);
  const addMessage = useRoomSessionStore((state) => state.addMessage);
  const clearMessages = useRoomSessionStore((state) => state.clearMessages);
  const lastToastRef = useRef<{ key: string; at: number } | null>(null);

  const resetClientState = useCallback(() => {
    resetSessionState();
    clearMessages();
  }, [clearMessages, resetSessionState]);

  const showSocketToast = useCallback(
    (title: string, message: string) => {
      if (!message) {
        return;
      }

      const now = Date.now();
      const key = message;
      if (
        lastToastRef.current &&
        lastToastRef.current.key === key &&
        now - lastToastRef.current.at < SOCKET_ERROR_TOAST_DEDUPE_MS
      ) {
        return;
      }

      lastToastRef.current = { key, at: now };
      toast({
        variant: "destructive",
        title,
        description: message,
      });
    },
    [toast],
  );

  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      return;
    }

    const socket = createSocket(accessToken);
    let isHandlingUnauthorized = false;

    const handleConnect = () => {
      setConnected(true);
      const cachedRoomCode = normalizeJoinRoomCode(useRoomSessionStore.getState().code);
      if (!cachedRoomCode) {
        return;
      }
      socket.emit("room:join", cachedRoomCode, (result: JoinResult) => {
        if (!result.success) {
          resetClientState();
        }
      });
    };

    const handleDisconnect = () => {
      setConnected(false);
    };

    const handleConnectError = (error: Error) => {
      console.error("Socket connection error:", error);
      const msg = error?.message ?? String(error);
      if (!msg.includes("Unauthorized")) {
        showSocketToast("Connection error", msg);
        return;
      }
      setConnected(false);
      if (isHandlingUnauthorized) {
        return;
      }
      isHandlingUnauthorized = true;
      void refreshAccessToken()
        .then(() => {
          disconnectSocket();
        })
        .catch(() => {
          resetClientState();
          useUserStore.getState().logout();
          disconnectSocket();
        })
        .finally(() => {
          isHandlingUnauthorized = false;
        });
    };

    const handleRoomJoined = applyRoomJoined;
    const handlePlayerJoined = applyPlayerJoined;
    const handlePlayerLeft = ({ playerId }: { playerId: string }) => applyPlayerLeft(playerId);
    const handlePlayerReady = ({ playerId, ready }: { playerId: string; ready: boolean }) =>
      applyPlayerReady(playerId, ready);
    const handleHostChanged = ({ newHostId }: { newHostId: string }) => applyHostChanged(newHostId);
    const handleGameStart = applyGameState;
    const handleStateUpdate = applyGameState;

    const handleChatMessage = (message: Parameters<typeof addMessage>[0]) => {
      addMessage(message);
    };

    const handleSocketError = (error: { code: string; message: string }) => {
      console.error("Socket error:", error);
      showSocketToast("Action failed", error.message);
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);
    socket.on("room:joined", handleRoomJoined);
    socket.on("room:player-joined", handlePlayerJoined);
    socket.on("room:player-left", handlePlayerLeft);
    socket.on("room:player-ready", handlePlayerReady);
    socket.on("room:host-changed", handleHostChanged);
    socket.on("room:game-start", handleGameStart);
    socket.on("game:state-update", handleStateUpdate);
    socket.on("chat:message", handleChatMessage);
    socket.on("error", handleSocketError);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
      socket.off("room:joined", handleRoomJoined);
      socket.off("room:player-joined", handlePlayerJoined);
      socket.off("room:player-left", handlePlayerLeft);
      socket.off("room:player-ready", handlePlayerReady);
      socket.off("room:host-changed", handleHostChanged);
      socket.off("room:game-start", handleGameStart);
      socket.off("game:state-update", handleStateUpdate);
      socket.off("chat:message", handleChatMessage);
      socket.off("error", handleSocketError);
      disconnectSocket();
    };
  }, [
    accessToken,
    addMessage,
    applyGameState,
    applyHostChanged,
    applyPlayerJoined,
    applyPlayerLeft,
    applyPlayerReady,
    applyRoomJoined,
    clearMessages,
    isAuthenticated,
    resetClientState,
    setConnected,
    showSocketToast,
  ]);

  const emit = useCallback(
    <K extends keyof ClientToServerEvents>(event: K, ...args: Parameters<ClientToServerEvents[K]>) => {
      const socket = getSocket();
      if (socket) {
        socket.emit(event, ...(trimTrailingUndefined(args) as Parameters<ClientToServerEvents[K]>));
      }
    },
    [],
  );

  const joinRoom = useCallback((roomCode: string, callback?: (result: JoinResult) => void) => {
    const socket = getSocket();
    if (!socket) return;
    const normalizedRoomCode = normalizeJoinRoomCode(roomCode);
    if (!normalizedRoomCode) {
      callback?.({
        success: false,
        code: SOCKET_ERROR_CODE.INVALID_PAYLOAD,
        message: SOCKET_ERROR_DETAIL_MESSAGE.INVALID_ROOM_CODE,
      });
      return;
    }
    socket.emit("room:join", normalizedRoomCode, callback);
  }, []);

  const createRoom = useCallback(
    (
      maxPlayers = DEFAULT_ROOM_MAX_PLAYERS,
      callback?: (result: CreateRoomResult) => void,
    ) => {
      const socket = getSocket();
      if (!socket) return;
      socket.emit("room:create", { maxPlayers, isPrivate: false }, callback);
    },
    [],
  );

  const leaveRoom = useCallback(
    (callback?: (result: SocketActionResult) => void) => {
      const socket = getSocket();
      if (!socket) {
        resetClientState();
        callback?.({ success: true });
        return;
      }
      socket.emit("room:leave", (result: SocketActionResult) => {
        if (result.success) {
          resetClientState();
          disconnectSocket();
        }
        callback?.(result);
      });
    },
    [resetClientState],
  );

  const setReady = useCallback(
    (ready: boolean, callback?: (result: SocketActionResult) => void) => {
      emit("room:ready", ready, callback);
    },
    [emit],
  );

  const startGame = useCallback(
    (callback?: (result: SocketActionResult) => void) => {
      emit("room:start", callback);
    },
    [emit],
  );

  const addLobbyBot = useCallback((callback?: (result: AddLobbyBotResult) => void) => {
    const socket = getSocket();
    if (!socket) return;
    socket.emit("room:add-bot", callback);
  }, []);

  const playCard = useCallback(
    (
      cardId: string,
      declaration: { type: string; number: number },
      callback?: (result: SocketActionResult) => void,
    ) => {
      emit(
        "game:play-card",
        {
          cardId,
          declaration: declaration as import("@sweet-spicy/shared-types").Declaration,
        },
        callback,
      );
    },
    [emit],
  );

  const drawPass = useCallback(
    (callback?: (result: SocketActionResult) => void) => {
      emit("game:draw-pass", callback);
    },
    [emit],
  );

  const challenge = useCallback(
    (challengeType: ChallengeType, callback?: (result: SocketActionResult) => void) => {
      emit("game:challenge", { challengeType }, callback);
    },
    [emit],
  );

  const claimChallenge = useCallback(
    (callback?: (result: SocketActionResult) => void) => {
      emit("game:claim-challenge", callback);
    },
    [emit],
  );

  const acceptDeclaration = useCallback(
    (callback?: (result: SocketActionResult) => void) => {
      emit("game:accept", callback);
    },
    [emit],
  );

  const challengePass = useCallback(
    (callback?: (result: SocketActionResult) => void) => {
      emit("game:challenge-pass", callback);
    },
    [emit],
  );

  const sendChatMessage = useCallback(
    (content: string) => {
      emit("chat:send", { content });
    },
    [emit],
  );

  return useMemo(
    () => ({
      joinRoom,
      createRoom,
      leaveRoom,
      setReady,
      startGame,
      addLobbyBot,
      playCard,
      drawPass,
      challenge,
      claimChallenge,
      acceptDeclaration,
      challengePass,
      sendChatMessage,
      resetClientState,
    }),
    [
      acceptDeclaration,
      addLobbyBot,
      challenge,
      challengePass,
      claimChallenge,
      createRoom,
      drawPass,
      joinRoom,
      leaveRoom,
      playCard,
      resetClientState,
      sendChatMessage,
      setReady,
      startGame,
    ],
  );
}
