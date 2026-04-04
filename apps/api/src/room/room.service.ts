import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import {
  DEFAULT_ROOM_MAX_PLAYERS,
  MIN_PLAYERS_TO_START,
  SOCKET_ERROR_CODE,
  SOCKET_ERROR_DETAIL_MESSAGE,
  SOCKET_ERROR_MESSAGE,
  type SocketErrorCode,
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

interface RoomFailure {
  ok: false;
  code: SocketErrorCode;
  message: string;
}

interface RoomSuccess {
  ok: true;
  room: ServerRoom;
}

export interface LeaveRoomResult {
  roomCode: string | null;
  room: ServerRoom | null;
  newHostId?: string;
  handedOffToBot?: boolean;
}

@Injectable()
export class RoomService {
  readonly rooms = new Map<string, ServerRoom>();
  readonly userToRoom = new Map<string, string>();

  private findRoomCodeByGamePlayer(userId: string): string | null {
    for (const [roomCode, room] of this.rooms) {
      if (room.gameState?.players.some((player) => player.id === userId)) {
        return roomCode;
      }
    }

    return null;
  }

  private reclaimLobbySeat(room: ServerRoom, userId: string, nickname: string): boolean {
    const player = room.players.find((roomPlayer) => roomPlayer.id === userId);
    if (!player) {
      return false;
    }

    player.nickname = nickname;
    if (player.isBot) {
      delete player.isBot;
    }

    return true;
  }

  private reclaimGameSeat(room: ServerRoom, userId: string, nickname: string): boolean {
    const player = room.gameState?.players.find((gamePlayer) => gamePlayer.id === userId);
    if (!player) {
      return false;
    }

    player.nickname = nickname;
    if (player.isBot) {
      delete player.isBot;
    }

    this.syncRoomPlayersFromGame(room);
    return true;
  }

  private exitPreviousRoomForSwitch(userId: string): LeaveRoomResult | undefined {
    const roomCode = this.userToRoom.get(userId);
    if (!roomCode) {
      return undefined;
    }

    const room = this.rooms.get(roomCode);
    if (room?.gameState) {
      return this.handoffUserToBot(userId);
    }

    return this.leaveRoom(userId);
  }

  toRoomState(room: ServerRoom): RoomState {
    return {
      roomCode: room.roomCode,
      hostId: room.hostId,
      status: room.status,
      maxPlayers: room.maxPlayers,
      players: room.players.map((player) => ({
        id: player.id,
        nickname: player.nickname,
        isHost: player.isHost,
        isReady: player.isReady,
        score: player.score,
        wonPileCount: player.wonPileCount,
        trophyCount: player.trophyCount,
        ...(player.isBot ? { isBot: true as const } : {}),
      })),
      createdAt: room.createdAt.toISOString(),
    };
  }

  createRoom(
    userId: string,
    nickname: string,
    maxPlayers = DEFAULT_ROOM_MAX_PLAYERS,
  ): { room: ServerRoom; previousExit?: LeaveRoomResult } {
    const previousExit = this.exitPreviousRoomForSwitch(userId);
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
    return { room, previousExit };
  }

  joinRoom(
    roomCode: string,
    userId: string,
    nickname: string,
  ): (RoomSuccess & { resumed?: boolean; previousExit?: LeaveRoomResult }) | RoomFailure {
    const code = roomCode.toUpperCase();
    const previousCode = this.userToRoom.get(userId);
    const room = this.rooms.get(code);
    if (!room) {
      return {
        ok: false,
        code: SOCKET_ERROR_CODE.ROOM_NOT_FOUND,
        message: SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.ROOM_NOT_FOUND],
      };
    }

    if (this.reclaimGameSeat(room, userId, nickname)) {
      this.userToRoom.set(userId, code);
      return { ok: true, room, resumed: true };
    }

    const hasExistingPlayer = this.reclaimLobbySeat(room, userId, nickname);
    if (hasExistingPlayer) {
      this.userToRoom.set(userId, code);
      return { ok: true, room, resumed: true };
    }

    if (room.status !== "WAITING") {
      return {
        ok: false,
        code: SOCKET_ERROR_CODE.ROOM_IN_PROGRESS,
        message: SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.ROOM_IN_PROGRESS],
      };
    }
    if (room.players.length >= room.maxPlayers) {
      return {
        ok: false,
        code: SOCKET_ERROR_CODE.ROOM_FULL,
        message: SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.ROOM_FULL],
      };
    }
    if (hasExistingPlayer) {
      return {
        ok: false,
        code: SOCKET_ERROR_CODE.ALREADY_IN_ROOM,
        message: SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.ALREADY_IN_ROOM],
      };
    }

    const previousExit = previousCode && previousCode !== code
      ? this.exitPreviousRoomForSwitch(userId)
      : undefined;

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
    return { ok: true, room, previousExit };
  }

  leaveRoom(userId: string): LeaveRoomResult {
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
      const nextHost = room.players.find((p) => !p.isBot) ?? room.players[0];
      room.hostId = nextHost.id;
      for (const p of room.players) {
        p.isHost = p.id === room.hostId;
      }
      newHostId = room.hostId;
    }

    return { roomCode, room, newHostId, handedOffToBot: false };
  }

  handoffUserToBot(userId: string): LeaveRoomResult {
    const roomCode = this.userToRoom.get(userId) ?? this.findRoomCodeByGamePlayer(userId);
    if (!roomCode) {
      return { roomCode: null, room: null, handedOffToBot: false };
    }

    const room = this.rooms.get(roomCode);
    if (!room?.gameState) {
      this.userToRoom.delete(userId);
      return { roomCode, room: room ?? null, handedOffToBot: false };
    }

    const player = room.gameState.players.find((gamePlayer) => gamePlayer.id === userId);
    if (!player) {
      this.userToRoom.delete(userId);
      return { roomCode, room, handedOffToBot: false };
    }

    player.isBot = true;
    this.userToRoom.delete(userId);
    this.syncRoomPlayersFromGame(room);

    return { roomCode, room, handedOffToBot: true };
  }

  setReady(userId: string, ready: boolean): RoomSuccess | RoomFailure {
    const roomCode = this.userToRoom.get(userId);
    if (!roomCode) {
      return {
        ok: false,
        code: SOCKET_ERROR_CODE.NOT_IN_ROOM,
        message: SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.NOT_IN_ROOM],
      };
    }
    const room = this.rooms.get(roomCode);
    if (!room) {
      this.userToRoom.delete(userId);
      return {
        ok: false,
        code: SOCKET_ERROR_CODE.NOT_IN_ROOM,
        message: SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.NOT_IN_ROOM],
      };
    }
    if (room.status !== "WAITING") {
      return {
        ok: false,
        code: SOCKET_ERROR_CODE.INVALID_PHASE,
        message: SOCKET_ERROR_DETAIL_MESSAGE.READY_WRONG_PHASE,
      };
    }
    const player = room.players.find((p) => p.id === userId);
    if (!player) {
      return {
        ok: false,
        code: SOCKET_ERROR_CODE.NOT_IN_ROOM,
        message: SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.NOT_IN_ROOM],
      };
    }
    player.isReady = ready;
    return { ok: true, room };
  }

  addLobbyBot(
    hostUserId: string,
    socketRoomCode?: string | null,
  ): ({ ok: true; room: ServerRoom; player: RoomPlayer } & RoomSuccess) | RoomFailure {
    const normalizedSocketCode = socketRoomCode ? socketRoomCode.toUpperCase() : undefined;
    let room: ServerRoom | undefined = normalizedSocketCode ? this.rooms.get(normalizedSocketCode) : undefined;
    if (room && !room.players.some((p) => p.id === hostUserId)) {
      room = undefined;
    }
    if (!room) {
      const mappedCode = this.userToRoom.get(hostUserId);
      room = mappedCode ? this.rooms.get(mappedCode) : undefined;
    }
    if (!room) {
      return {
        ok: false,
        code: SOCKET_ERROR_CODE.NOT_IN_ROOM,
        message: SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.NOT_IN_ROOM],
      };
    }
    if (!room.players.some((p) => p.id === hostUserId)) {
      return {
        ok: false,
        code: SOCKET_ERROR_CODE.NOT_IN_ROOM,
        message: SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.NOT_IN_ROOM],
      };
    }
    const mapCode = this.userToRoom.get(hostUserId);
    if (mapCode !== room.roomCode) {
      this.userToRoom.set(hostUserId, room.roomCode);
    }
    if (room.hostId !== hostUserId) {
      return {
        ok: false,
        code: SOCKET_ERROR_CODE.HOST_ONLY,
        message: SOCKET_ERROR_DETAIL_MESSAGE.ADD_BOT_NOT_HOST,
      };
    }
    if (room.status !== "WAITING") {
      return {
        ok: false,
        code: SOCKET_ERROR_CODE.ADD_BOT_NOT_ALLOWED,
        message: SOCKET_ERROR_DETAIL_MESSAGE.ADD_BOT_WRONG_PHASE,
      };
    }
    if (room.players.length >= room.maxPlayers) {
      return {
        ok: false,
        code: SOCKET_ERROR_CODE.ROOM_FULL,
        message: SOCKET_ERROR_DETAIL_MESSAGE.ADD_BOT_ROOM_FULL,
      };
    }

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

  startGame(hostId: string): RoomSuccess | RoomFailure {
    const roomCode = this.userToRoom.get(hostId);
    if (!roomCode) {
      return {
        ok: false,
        code: SOCKET_ERROR_CODE.NOT_IN_ROOM,
        message: SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.NOT_IN_ROOM],
      };
    }
    const room = this.rooms.get(roomCode);
    if (!room) {
      return {
        ok: false,
        code: SOCKET_ERROR_CODE.ROOM_NOT_FOUND,
        message: SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.ROOM_NOT_FOUND],
      };
    }
    if (room.hostId !== hostId) {
      return {
        ok: false,
        code: SOCKET_ERROR_CODE.HOST_ONLY,
        message: SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.HOST_ONLY],
      };
    }
    if (room.players.length < MIN_PLAYERS_TO_START) {
      return {
        ok: false,
        code: SOCKET_ERROR_CODE.MIN_PLAYERS_NOT_MET,
        message: SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.MIN_PLAYERS_NOT_MET],
      };
    }
    if (!room.players.every((p) => p.isReady)) {
      return {
        ok: false,
        code: SOCKET_ERROR_CODE.ALL_PLAYERS_NOT_READY,
        message: SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.ALL_PLAYERS_NOT_READY],
      };
    }

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
    room.status = room.gameState.phase === "END_GAME" ? "FINISHED" : "IN_PROGRESS";
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
