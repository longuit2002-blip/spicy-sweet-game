import type { GameCard } from "./game.js";
import type { SocketErrorCode } from "./socket-error-codes.js";

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

export type SocketActionResult =
  | { success: true }
  | { success: false; code: SocketErrorCode; message: string };

export type JoinResult =
  | { success: true; room: RoomState; resumed?: boolean }
  | { success: false; code: SocketErrorCode; message: string };

export interface CreateRoomData {
  maxPlayers?: number;
  isPrivate?: boolean;
}

export type CreateRoomResult =
  | { success: true; room: RoomState }
  | { success: false; code: SocketErrorCode; message: string };

export type AddLobbyBotResult =
  | { success: true; room: RoomState; player: RoomPlayer }
  | { success: false; code: SocketErrorCode; message: string };

export interface Score {
  playerId: string;
  nickname: string;
  score: number;
}
