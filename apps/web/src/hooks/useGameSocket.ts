"use client";

import { useEffect, useCallback } from "react";
import { createSocket, getSocket, disconnectSocket } from "@/lib/socket-client";
import { useUserStore } from "@/stores/userStore";
import { useRoomStore } from "@/stores/roomStore";
import { useGameStore } from "@/stores/gameStore";
import { useChatStore } from "@/stores/chatStore";
import type {
  AddLobbyBotResult,
  ChallengeType,
  ClientGameState,
  ClientToServerEvents,
} from "@sweet-spicy/shared-types";
import { DEFAULT_ROOM_MAX_PLAYERS } from "@sweet-spicy/shared-types";

export function useGameSocket() {
  const { accessToken, isAuthenticated } = useUserStore();
  const {
    setPlayers,
    addPlayer,
    removePlayer,
    setPlayerReady,
    setConnected,
    setRoomCode,
    setMaxPlayers,
  } = useRoomStore();
  const { setGameState } = useGameStore();
  const { addMessage } = useChatStore();

  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      return;
    }

    const socket = createSocket(accessToken);

    socket.on("connect", () => {
      setConnected(true);
    });

    socket.on("disconnect", () => {
      setConnected(false);
    });

    socket.on("connect_error", (error) => {
      console.error("Socket connection error:", error);
      const msg = error?.message ?? String(error);
      if (msg.includes("Unauthorized")) {
        useUserStore.getState().logout();
        disconnectSocket();
        if (typeof window !== "undefined" && window.location.pathname.startsWith("/room")) {
          window.location.assign("/");
        }
      }
    });

    socket.on("room:joined", (room) => {
      setPlayers(room.players.map((p) => ({ ...p, isReady: p.isReady ?? false })));
      setRoomCode(room.roomCode);
      setMaxPlayers(room.maxPlayers);
    });

    socket.on("room:player-joined", (player) => {
      addPlayer({
        id: player.id,
        nickname: player.nickname,
        isReady: player.isReady ?? false,
        isHost: player.isHost,
        ...(player.isBot ? { isBot: true } : {}),
      });
    });

    socket.on("room:player-left", ({ playerId }) => {
      removePlayer(playerId);
    });

    socket.on("room:player-ready", ({ playerId, ready }) => {
      setPlayerReady(playerId, ready);
    });

    socket.on("room:game-start", (gameState: ClientGameState) => {
      setGameState(gameState);
    });

    socket.on("game:state-update", (gameState: ClientGameState) => {
      setGameState(gameState);
    });

    socket.on("chat:message", (message) => {
      addMessage(message);
    });

    socket.on("error", (error) => {
      console.error("Socket error:", error);
    });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("connect_error");
      socket.off("room:joined");
      socket.off("room:player-joined");
      socket.off("room:player-left");
      socket.off("room:player-ready");
      socket.off("room:game-start");
      socket.off("game:state-update");
      socket.off("chat:message");
      socket.off("error");
      disconnectSocket();
    };
  }, [
    isAuthenticated,
    accessToken,
    setPlayers,
    addPlayer,
    removePlayer,
    setPlayerReady,
    setGameState,
    setConnected,
    setRoomCode,
    setMaxPlayers,
    addMessage,
  ]);

  const emit = useCallback(<K extends keyof ClientToServerEvents>(
    event: K,
    ...args: Parameters<ClientToServerEvents[K]>
  ) => {
    const socket = getSocket();
    if (socket) {
      socket.emit(event, ...args);
    }
  }, []);

  const joinRoom = useCallback((roomCode: string, callback?: (result: unknown) => void) => {
    const socket = getSocket();
    if (!socket) return;
    socket.emit("room:join", roomCode, callback);
  }, []);

  const createRoom = useCallback((maxPlayers = DEFAULT_ROOM_MAX_PLAYERS, callback?: (result: unknown) => void) => {
    const socket = getSocket();
    if (!socket) return;
    socket.emit("room:create", { maxPlayers, isPrivate: false }, callback);
  }, []);

  const leaveRoom = useCallback(() => {
    emit("room:leave");
  }, [emit]);

  const setReady = useCallback(
    (ready: boolean) => {
      emit("room:ready", ready);
    },
    [emit],
  );

  const startGame = useCallback(() => {
    emit("room:start");
  }, [emit]);

  const addLobbyBot = useCallback((callback?: (result: AddLobbyBotResult) => void) => {
    const socket = getSocket();
    if (!socket) return;
    if (callback) {
      socket.emit("room:add-bot", callback);
    } else {
      socket.emit("room:add-bot");
    }
  }, []);

  const playCard = useCallback(
    (cardId: string, declaration: { type: string; number: number }) => {
      emit("game:play-card", {
        cardId,
        declaration: declaration as import("@sweet-spicy/shared-types").Declaration,
      });
    },
    [emit],
  );

  const drawPass = useCallback(() => {
    emit("game:draw-pass");
  }, [emit]);

  const challenge = useCallback(
    (challengeType: ChallengeType) => {
      emit("game:challenge", { challengeType });
    },
    [emit],
  );

  const claimChallenge = useCallback(() => {
    emit("game:claim-challenge");
  }, [emit]);

  const acceptDeclaration = useCallback(() => {
    emit("game:accept");
  }, [emit]);

  const sendChatMessage = useCallback(
    (content: string) => {
      emit("chat:send", { content });
    },
    [emit],
  );

  return {
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
    sendChatMessage,
  };
}
