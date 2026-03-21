import { Injectable } from "@nestjs/common";
import type { GameState } from "@sweet-spicy/shared-types";
import {
  createInitialState,
  startGame as engineStartGame,
  generateRoomCode,
} from "@sweet-spicy/game-logic";
import type { RoomPlayer, RoomState } from "@sweet-spicy/shared-types";

export interface ServerRoom {
  roomCode: string;
  hostId: string;
  status: "WAITING" | "IN_PROGRESS" | "FINISHED" | "CANCELLED";
  maxPlayers: number;
  players: RoomPlayer[];
  gameState: GameState | null;
  createdAt: Date;
}

@Injectable()
export class RoomService {
  readonly rooms = new Map<string, ServerRoom>();
  readonly userToRoom = new Map<string, string>();

  toRoomState(room: ServerRoom): RoomState {
    return {
      roomCode: room.roomCode,
      hostId: room.hostId,
      status: room.status,
      maxPlayers: room.maxPlayers,
      players: room.players,
      createdAt: room.createdAt.toISOString(),
    };
  }

  createRoom(userId: string, nickname: string, maxPlayers = 6): ServerRoom {
    const roomCode = generateRoomCode();
    const player: RoomPlayer = {
      id: userId,
      nickname,
      isHost: true,
      isReady: true,
      score: 0,
      hand: [],
      successfulBluffs: 0,
      successfulChallenges: 0,
    };
    const room: ServerRoom = {
      roomCode,
      hostId: userId,
      status: "WAITING",
      maxPlayers,
      players: [player],
      gameState: null,
      createdAt: new Date(),
    };
    this.rooms.set(roomCode, room);
    this.userToRoom.set(userId, roomCode);
    return room;
  }

  joinRoom(roomCode: string, userId: string, nickname: string): { ok: true; room: ServerRoom } | { ok: false; error: string } {
    const code = roomCode.toUpperCase();
    const room = this.rooms.get(code);
    if (!room) return { ok: false, error: "Room not found" };
    if (room.status !== "WAITING") return { ok: false, error: "Game already in progress" };
    if (room.players.length >= room.maxPlayers) return { ok: false, error: "Room is full" };
    if (room.players.some((p) => p.id === userId)) return { ok: false, error: "Already in this room" };

    const player: RoomPlayer = {
      id: userId,
      nickname,
      isHost: false,
      isReady: false,
      score: 0,
      hand: [],
      successfulBluffs: 0,
      successfulChallenges: 0,
    };
    room.players.push(player);
    this.userToRoom.set(userId, code);
    return { ok: true, room };
  }

  leaveRoom(userId: string): { roomCode: string | null; room: ServerRoom | null; newHostId?: string } {
    const roomCode = this.userToRoom.get(userId) ?? null;
    if (!roomCode) return { roomCode: null, room: null };
    const room = this.rooms.get(roomCode);
    if (!room) {
      this.userToRoom.delete(userId);
      return { roomCode: null, room: null };
    }

    room.players = room.players.filter((p) => p.id !== userId);
    this.userToRoom.delete(userId);

    if (room.players.length === 0) {
      this.rooms.delete(roomCode);
      return { roomCode, room: null };
    }

    let newHostId: string | undefined;
    if (room.hostId === userId) {
      room.hostId = room.players[0].id;
      room.players[0].isHost = true;
      newHostId = room.hostId;
    }

    return { roomCode, room, newHostId };
  }

  setReady(userId: string, ready: boolean): ServerRoom | null {
    const roomCode = this.userToRoom.get(userId);
    if (!roomCode) return null;
    const room = this.rooms.get(roomCode);
    if (!room) return null;
    const player = room.players.find((p) => p.id === userId);
    if (player) player.isReady = ready;
    return room;
  }

  startGame(hostId: string): { ok: true; room: ServerRoom } | { ok: false; error: string } {
    const roomCode = this.userToRoom.get(hostId);
    if (!roomCode) return { ok: false, error: "Not in a room" };
    const room = this.rooms.get(roomCode);
    if (!room) return { ok: false, error: "Room not found" };
    if (room.hostId !== hostId) return { ok: false, error: "Only the host can start the game" };
    if (room.players.length < 2) return { ok: false, error: "Need at least 2 players" };
    if (!room.players.every((p) => p.isReady)) return { ok: false, error: "All players must be ready" };

    room.status = "IN_PROGRESS";
    let gs = createInitialState(room.roomCode);
    gs.players = room.players.map((p) => ({
      id: p.id,
      nickname: p.nickname,
      hand: [],
      score: 0,
      successfulBluffs: p.successfulBluffs ?? 0,
      successfulChallenges: p.successfulChallenges ?? 0,
      isReady: p.isReady,
      isHost: p.isHost,
    }));
    gs = engineStartGame(gs);
    room.gameState = gs;
    room.players = gs.players.map((gp) => ({
      id: gp.id,
      nickname: gp.nickname,
      isHost: room.hostId === gp.id,
      isReady: true,
      score: gp.score,
      hand: gp.hand,
      successfulBluffs: gp.successfulBluffs,
      successfulChallenges: gp.successfulChallenges,
    }));
    return { ok: true, room };
  }

  getRoomByCode(roomCode: string): ServerRoom | undefined {
    return this.rooms.get(roomCode.toUpperCase());
  }

  getRoomForUser(userId: string): ServerRoom | undefined {
    const code = this.userToRoom.get(userId);
    return code ? this.rooms.get(code) : undefined;
  }
}
