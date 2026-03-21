import type { GameCard } from "./game.js";

export type RoomStatus = "WAITING" | "IN_PROGRESS" | "FINISHED" | "CANCELLED";

/** Lobby / socket player (may omit hand when hidden) */
export interface RoomPlayer {
  id: string;
  nickname: string;
  avatarUrl?: string;
  isHost: boolean;
  isReady: boolean;
  score: number;
  hand?: GameCard[];
  successfulBluffs?: number;
  successfulChallenges?: number;
}

export interface RoomState {
  roomCode: string;
  hostId: string;
  status: RoomStatus;
  maxPlayers: number;
  players: RoomPlayer[];
  createdAt: string;
}

export interface JoinResult {
  success: boolean;
  room?: RoomState;
  error?: string;
}

export interface CreateRoomData {
  maxPlayers?: number;
  isPrivate?: boolean;
}

export interface CreateRoomResult {
  success: boolean;
  room?: RoomState;
  error?: string;
}

export interface Score {
  playerId: string;
  nickname: string;
  score: number;
}
