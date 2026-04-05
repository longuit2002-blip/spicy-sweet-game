import { create } from "zustand";
import {
  DEFAULT_ROOM_MAX_PLAYERS,
  type ChatMessage,
  type ClientGameState,
  type RoomPlayer,
  type RoomState,
} from "@sweet-spicy/shared-types";

function toRoomPlayersFromGameState(gameState: ClientGameState): RoomPlayer[] {
  return gameState.players.map((player) => ({
    id: player.id,
    nickname: player.nickname,
    isReady: player.isReady,
    isHost: player.isHost ?? false,
    score: player.score,
    wonPileCount: player.wonPileCount,
    trophyCount: player.trophyCount,
    ...(player.isBot ? { isBot: true as const } : {}),
  }));
}

interface RoomSessionState {
  code: string | null;
  players: RoomPlayer[];
  maxPlayers: number;
  gameState: ClientGameState | null;
  messages: ChatMessage[];
  isConnected: boolean;
  setConnected: (connected: boolean) => void;
  applyRoomJoined: (room: RoomState) => void;
  applyPlayerJoined: (player: RoomPlayer) => void;
  applyPlayerLeft: (playerId: string) => void;
  applyPlayerReady: (playerId: string, ready: boolean) => void;
  applyHostChanged: (hostId: string) => void;
  applyGameState: (gameState: ClientGameState) => void;
  addMessage: (message: ChatMessage) => void;
  clearMessages: () => void;
  reset: () => void;
}

const INITIAL_SESSION_STATE = {
  code: null,
  players: [] as RoomPlayer[],
  maxPlayers: DEFAULT_ROOM_MAX_PLAYERS,
  gameState: null as ClientGameState | null,
  messages: [] as ChatMessage[],
  isConnected: false,
};

export const useRoomSessionStore = create<RoomSessionState>((set) => ({
  ...INITIAL_SESSION_STATE,

  setConnected: (isConnected) => set({ isConnected }),

  applyRoomJoined: (room) =>
    set({
      code: room.roomCode,
      maxPlayers: room.maxPlayers,
      players: room.players,
    }),

  applyPlayerJoined: (player) =>
    set((state) => ({
      players: state.players.some((currentPlayer) => currentPlayer.id === player.id)
        ? state.players
        : [...state.players, player],
    })),

  applyPlayerLeft: (playerId) =>
    set((state) => ({
      players: state.players.filter((player) => player.id !== playerId),
    })),

  applyPlayerReady: (playerId, ready) =>
    set((state) => ({
      players: state.players.map((player) =>
        player.id === playerId ? { ...player, isReady: ready } : player,
      ),
    })),

  applyHostChanged: (hostId) =>
    set((state) => ({
      players: state.players.map((player) => ({
        ...player,
        isHost: player.id === hostId,
      })),
    })),

  applyGameState: (gameState) =>
    set((state) => ({
      code: gameState.roomCode,
      players: toRoomPlayersFromGameState(gameState),
      maxPlayers: state.maxPlayers,
      gameState,
    })),

  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message],
    })),

  clearMessages: () => set({ messages: [] }),

  reset: () => set({ ...INITIAL_SESSION_STATE }),
}));
