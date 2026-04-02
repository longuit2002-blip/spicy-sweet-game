import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import {
  DEFAULT_ROOM_MAX_PLAYERS,
  MIN_PLAYERS_TO_START,
  type GameState,
  type RoomPlayer,
  type RoomState,
} from "@sweet-spicy/shared-types";
import {
  computePlayerFinalScore,
  createInitialState,
  pickNextLobbyBotNickname,
  startGame as engineStartGame,
  generateRoomCode,
} from "@sweet-spicy/game-logic";

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

  createRoom(userId: string, nickname: string, maxPlayers = DEFAULT_ROOM_MAX_PLAYERS): ServerRoom {
    if (this.userToRoom.has(userId)) {
      this.leaveRoom(userId);
    }
    const roomCode = generateRoomCode();
    const player: RoomPlayer = {
      id: userId,
      nickname,
      isHost: true,
      isReady: true,
      score: 0,
      hand: [],
      wonPileCount: 0,
      trophyCount: 0,
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
    const previousCode = this.userToRoom.get(userId);
    if (previousCode && previousCode !== code) {
      this.leaveRoom(userId);
    }
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
      wonPileCount: 0,
      trophyCount: 0,
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
      const nextHost = room.players.find((p) => !p.isBot) ?? room.players[0]!;
      room.hostId = nextHost.id;
      for (const p of room.players) {
        p.isHost = p.id === room.hostId;
      }
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

  addLobbyBot(
    hostUserId: string,
    socketRoomCode?: string | null,
  ): { ok: true; room: ServerRoom; player: RoomPlayer } | { ok: false; error: string } {
    const normalizedSocketCode = socketRoomCode ? socketRoomCode.toUpperCase() : undefined;
    let room: ServerRoom | undefined = normalizedSocketCode ? this.rooms.get(normalizedSocketCode) : undefined;
    if (room && !room.players.some((p) => p.id === hostUserId)) {
      room = undefined;
    }
    if (!room) {
      const mappedCode = this.userToRoom.get(hostUserId);
      room = mappedCode ? this.rooms.get(mappedCode) : undefined;
    }
    if (!room) return { ok: false, error: "Not in a room" };
    if (!room.players.some((p) => p.id === hostUserId)) {
      return { ok: false, error: "Not in this room" };
    }
    const mapCode = this.userToRoom.get(hostUserId);
    if (mapCode !== room.roomCode) {
      this.userToRoom.set(hostUserId, room.roomCode);
    }
    if (room.hostId !== hostUserId) return { ok: false, error: "Only the host can add bots" };
    if (room.status !== "WAITING") return { ok: false, error: "Bots can only be added in the lobby" };
    if (room.players.length >= room.maxPlayers) return { ok: false, error: "Room is full" };

    const nickname = pickNextLobbyBotNickname(room.players.map((p) => p.nickname));
    const player: RoomPlayer = {
      id: `bot:${randomUUID()}`,
      nickname,
      isHost: false,
      isReady: true,
      isBot: true,
      score: 0,
      hand: [],
      wonPileCount: 0,
      trophyCount: 0,
    };
    room.players.push(player);
    return { ok: true, room, player };
  }

  startGame(hostId: string): { ok: true; room: ServerRoom } | { ok: false; error: string } {
    const roomCode = this.userToRoom.get(hostId);
    if (!roomCode) return { ok: false, error: "Not in a room" };
    const room = this.rooms.get(roomCode);
    if (!room) return { ok: false, error: "Room not found" };
    if (room.hostId !== hostId) return { ok: false, error: "Only the host can start the game" };
    if (room.players.length < MIN_PLAYERS_TO_START) {
      return { ok: false, error: "Need at least 2 players" };
    }
    if (!room.players.every((p) => p.isReady)) return { ok: false, error: "All players must be ready" };

    room.status = "IN_PROGRESS";
    let gs = createInitialState(room.roomCode);
    gs.players = room.players.map((p) => ({
      id: p.id,
      nickname: p.nickname,
      hand: [],
      wonPile: [],
      trophyCount: 0,
      isReady: p.isReady,
      isHost: p.isHost,
      ...(p.isBot ? { isBot: true as const } : {}),
    }));
    gs = engineStartGame(gs);
    room.gameState = gs;
    room.players = gs.players.map((gp) => ({
      id: gp.id,
      nickname: gp.nickname,
      isHost: room.hostId === gp.id,
      isReady: true,
      score: computePlayerFinalScore(gp),
      hand: gp.hand,
      wonPileCount: gp.wonPile.length,
      trophyCount: gp.trophyCount,
      ...(gp.isBot ? { isBot: true as const } : {}),
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

  /** Keep `room.players` in sync with authoritative `room.gameState` (hands, scores, flags). */
  syncRoomPlayersFromGame(room: ServerRoom): void {
    if (!room.gameState) return;
    room.players = room.gameState.players.map((gp) => ({
      id: gp.id,
      nickname: gp.nickname,
      isHost: room.hostId === gp.id,
      isReady: true,
      score: computePlayerFinalScore(gp),
      hand: gp.hand,
      wonPileCount: gp.wonPile.length,
      trophyCount: gp.trophyCount,
      ...(gp.isBot ? { isBot: true as const } : {}),
    }));
  }
}
