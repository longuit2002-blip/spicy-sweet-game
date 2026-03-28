import { create } from "zustand";

interface RoomPlayer {
  id: string;
  nickname: string;
  isReady: boolean;
  isHost?: boolean;
  /** Present when server syncs game scores onto room players */
  score?: number;
  trophyCount?: number;
}

interface RoomState {
  code: string | null;
  players: RoomPlayer[];
  isConnected: boolean;
  maxPlayers: number;

  setRoomCode: (code: string) => void;
  setPlayers: (players: RoomPlayer[]) => void;
  addPlayer: (player: RoomPlayer) => void;
  removePlayer: (playerId: string) => void;
  setPlayerReady: (playerId: string, isReady: boolean) => void;
  setConnected: (connected: boolean) => void;
  reset: () => void;
}

export const useRoomStore = create<RoomState>((set) => ({
  code: null,
  players: [],
  isConnected: false,
  maxPlayers: 6,

  setRoomCode: (code) => set({ code }),

  setPlayers: (players) => set({ players }),

  addPlayer: (player) =>
    set((state) => ({
      players: [...state.players, player],
    })),

  removePlayer: (playerId) =>
    set((state) => ({
      players: state.players.filter((p) => p.id !== playerId),
    })),

  setPlayerReady: (playerId, isReady) =>
    set((state) => ({
      players: state.players.map((p) => (p.id === playerId ? { ...p, isReady } : p)),
    })),

  setConnected: (connected) => set({ isConnected: connected }),

  reset: () =>
    set({
      code: null,
      players: [],
      isConnected: false,
    }),
}));
