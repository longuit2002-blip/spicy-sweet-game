import type { GameCard } from "./game.js";

export type RoomStatus = "WAITING" | "IN_PROGRESS" | "FINISHED" | "CANCELLED";

/** Lobby / socket player (may omit hand when hidden) */
export interface RoomPlayer {
  id: string;
  nickname: string;
  avatarUrl?: string;
  isHost: boolean;
  isReady: boolean;
  /** Running total from won pile + trophies (derived from game state). */
  score: number;
  hand?: GameCard[];
  wonPileCount?: number;
  trophyCount?: number;
  /** Server-added lobby / game bot (no real socket). */
  isBot?: boolean;
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

export interface AddLobbyBotResult {
  success: boolean;
  room?: RoomState;
  player?: RoomPlayer;
  error?: string;
}

export interface Score {
  playerId: string;
  nickname: string;
  score: number;
}
