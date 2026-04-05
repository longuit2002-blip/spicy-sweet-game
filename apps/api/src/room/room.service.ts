import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import {
  DEFAULT_ROOM_MAX_PLAYERS,
  MIN_PLAYERS_TO_START,
  SOCKET_ERROR_CODE,
  SOCKET_ERROR_DETAIL_MESSAGE,
  SOCKET_ERROR_MESSAGE,
  type GameState,
  type RoomPlayer,
  type RoomState,
  type SocketErrorCode,
} from "@sweet-spicy/shared-types";
import {
  computePlayerFinalScore,
  createInitialState,
  generateRoomCode,
  pickNextLobbyBotNickname,
  startGame as engineStartGame,
} from "@sweet-spicy/game-logic";
import { RoomObservabilityService } from "./room-observability.service";
import { RoomRepository } from "./room.repository";
import { RoomSessionPersistenceService } from "./room-session-persistence.service";

export interface ServerRoom {
  roomCode: string;
  hostId: string;
  status: "WAITING" | "IN_PROGRESS" | "FINISHED" | "CANCELLED";
  maxPlayers: number;
  players: RoomPlayer[];
  gameState: GameState | null;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
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
  constructor(
    private readonly roomRepository: RoomRepository,
    private readonly persistence: RoomSessionPersistenceService,
    private readonly observability: RoomObservabilityService,
  ) {}

  private findRoomCodeByGamePlayer(userId: string): string | null {
    for (const [roomCode, room] of this.roomRepository.getRoomEntries()) {
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
    const roomCode = this.roomRepository.getRoomCodeForUser(userId);
    if (!roomCode) {
      return undefined;
    }

    const room = this.roomRepository.getRoomByCode(roomCode);
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
      startedAt: null,
      finishedAt: null,
    };
    this.roomRepository.saveRoom(room);
    this.roomRepository.assignUserToRoom(userId, roomCode);
    this.persistence.persistRoomSnapshot(room);
    return { room, previousExit };
  }

  joinRoom(
    roomCode: string,
    userId: string,
    nickname: string,
  ): (RoomSuccess & { resumed?: boolean; previousExit?: LeaveRoomResult }) | RoomFailure {
    const code = roomCode.toUpperCase();
    const previousCode = this.roomRepository.getRoomCodeForUser(userId);
    const room = this.roomRepository.getRoomByCode(code);
    if (!room) {
      return {
        ok: false,
        code: SOCKET_ERROR_CODE.ROOM_NOT_FOUND,
        message: SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.ROOM_NOT_FOUND],
      };
    }

    if (this.reclaimGameSeat(room, userId, nickname)) {
      this.roomRepository.assignUserToRoom(userId, code);
      this.observability.recordReconnectSuccess();
      this.persistence.persistRoomSnapshot(room);
      return { ok: true, room, resumed: true };
    }

    const hasExistingPlayer = this.reclaimLobbySeat(room, userId, nickname);
    if (hasExistingPlayer) {
      this.roomRepository.assignUserToRoom(userId, code);
      this.observability.recordReconnectSuccess();
      this.persistence.persistRoomSnapshot(room);
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
    this.roomRepository.assignUserToRoom(userId, code);
    this.persistence.persistRoomSnapshot(room);
    return { ok: true, room, previousExit };
  }

  leaveRoom(userId: string): LeaveRoomResult {
    const roomCode = this.roomRepository.getRoomCodeForUser(userId) ?? null;
    if (!roomCode) {
      return { roomCode: null, room: null };
    }

    const room = this.roomRepository.getRoomByCode(roomCode);
    if (!room) {
      this.roomRepository.clearUserRoom(userId);
      return { roomCode: null, room: null };
    }

    room.players = room.players.filter((player) => player.id !== userId);
    this.roomRepository.clearUserRoom(userId);

    if (room.players.length === 0) {
      this.roomRepository.deleteRoom(roomCode);
      this.persistence.deleteRoomSnapshot(roomCode);
      return { roomCode, room: null };
    }

    let newHostId: string | undefined;
    if (room.hostId === userId) {
      const nextHost = room.players.find((player) => !player.isBot) ?? room.players[0];
      room.hostId = nextHost.id;
      room.players = room.players.map((player) => ({
        ...player,
        isHost: player.id === room.hostId,
      }));
      newHostId = room.hostId;
    }

    this.persistence.persistRoomSnapshot(room);
    return { roomCode, room, newHostId, handedOffToBot: false };
  }

  handoffUserToBot(userId: string): LeaveRoomResult {
    const roomCode =
      this.roomRepository.getRoomCodeForUser(userId) ?? this.findRoomCodeByGamePlayer(userId);
    if (!roomCode) {
      return { roomCode: null, room: null, handedOffToBot: false };
    }

    const room = this.roomRepository.getRoomByCode(roomCode);
    if (!room?.gameState) {
      this.roomRepository.clearUserRoom(userId);
      return { roomCode, room: room ?? null, handedOffToBot: false };
    }

    const player = room.gameState.players.find((gamePlayer) => gamePlayer.id === userId);
    if (!player) {
      this.roomRepository.clearUserRoom(userId);
      return { roomCode, room, handedOffToBot: false };
    }

    player.isBot = true;
    this.roomRepository.clearUserRoom(userId);
    this.syncRoomPlayersFromGame(room);
    this.observability.recordDisconnectHandoff();
    this.persistence.persistRoomSnapshot(room);

    return { roomCode, room, handedOffToBot: true };
  }

  setReady(userId: string, ready: boolean): RoomSuccess | RoomFailure {
    const roomCode = this.roomRepository.getRoomCodeForUser(userId);
    if (!roomCode) {
      return {
        ok: false,
        code: SOCKET_ERROR_CODE.NOT_IN_ROOM,
        message: SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.NOT_IN_ROOM],
      };
    }

    const room = this.roomRepository.getRoomByCode(roomCode);
    if (!room) {
      this.roomRepository.clearUserRoom(userId);
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

    const player = room.players.find((roomPlayer) => roomPlayer.id === userId);
    if (!player) {
      return {
        ok: false,
        code: SOCKET_ERROR_CODE.NOT_IN_ROOM,
        message: SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.NOT_IN_ROOM],
      };
    }

    player.isReady = ready;
    this.persistence.persistRoomSnapshot(room);
    return { ok: true, room };
  }

  addLobbyBot(
    hostUserId: string,
    socketRoomCode?: string | null,
  ): ({ ok: true; room: ServerRoom; player: RoomPlayer } & RoomSuccess) | RoomFailure {
    const normalizedSocketCode = socketRoomCode ? socketRoomCode.toUpperCase() : undefined;
    let room = normalizedSocketCode
      ? this.roomRepository.getRoomByCode(normalizedSocketCode)
      : undefined;
    if (room && !room.players.some((player) => player.id === hostUserId)) {
      room = undefined;
    }
    if (!room) {
      const mappedCode = this.roomRepository.getRoomCodeForUser(hostUserId);
      room = mappedCode ? this.roomRepository.getRoomByCode(mappedCode) : undefined;
    }
    if (!room) {
      return {
        ok: false,
        code: SOCKET_ERROR_CODE.NOT_IN_ROOM,
        message: SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.NOT_IN_ROOM],
      };
    }
    if (!room.players.some((player) => player.id === hostUserId)) {
      return {
        ok: false,
        code: SOCKET_ERROR_CODE.NOT_IN_ROOM,
        message: SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.NOT_IN_ROOM],
      };
    }
    const mappedCode = this.roomRepository.getRoomCodeForUser(hostUserId);
    if (mappedCode !== room.roomCode) {
      this.roomRepository.assignUserToRoom(hostUserId, room.roomCode);
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

    const nickname = pickNextLobbyBotNickname(room.players.map((player) => player.nickname));
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
    this.persistence.persistRoomSnapshot(room);
    return { ok: true, room, player };
  }

  startGame(hostId: string): RoomSuccess | RoomFailure {
    const roomCode = this.roomRepository.getRoomCodeForUser(hostId);
    if (!roomCode) {
      return {
        ok: false,
        code: SOCKET_ERROR_CODE.NOT_IN_ROOM,
        message: SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.NOT_IN_ROOM],
      };
    }
    const room = this.roomRepository.getRoomByCode(roomCode);
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
    if (!room.players.every((player) => player.isReady)) {
      return {
        ok: false,
        code: SOCKET_ERROR_CODE.ALL_PLAYERS_NOT_READY,
        message: SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.ALL_PLAYERS_NOT_READY],
      };
    }

    room.status = "IN_PROGRESS";
    room.startedAt = new Date();
    room.finishedAt = null;
    let gameState = createInitialState(room.roomCode);
    gameState.players = room.players.map((player) => ({
      id: player.id,
      nickname: player.nickname,
      hand: [],
      wonPile: [],
      trophyCount: 0,
      isReady: player.isReady,
      isHost: player.isHost,
      ...(player.isBot ? { isBot: true as const } : {}),
    }));
    gameState = engineStartGame(gameState);
    room.gameState = gameState;
    room.players = gameState.players.map((player) => ({
      id: player.id,
      nickname: player.nickname,
      isHost: room.hostId === player.id,
      isReady: true,
      score: computePlayerFinalScore(player),
      hand: player.hand,
      wonPileCount: player.wonPile.length,
      trophyCount: player.trophyCount,
      ...(player.isBot ? { isBot: true as const } : {}),
    }));
    this.persistence.persistRoomSnapshot(room);
    return { ok: true, room };
  }

  getRoomByCode(roomCode: string): ServerRoom | undefined {
    return this.roomRepository.getRoomByCode(roomCode);
  }

  getRoomForUser(userId: string): ServerRoom | undefined {
    const roomCode = this.roomRepository.getRoomCodeForUser(userId);
    return roomCode ? this.roomRepository.getRoomByCode(roomCode) : undefined;
  }

  /** Keep `room.players` in sync with authoritative `room.gameState` (hands, scores, flags). */
  syncRoomPlayersFromGame(room: ServerRoom): void {
    if (!room.gameState) {
      return;
    }

    room.status = room.gameState.phase === "END_GAME" ? "FINISHED" : "IN_PROGRESS";
    if (room.status === "FINISHED" && room.finishedAt == null) {
      room.finishedAt = new Date();
      if (room.startedAt) {
        const durationSeconds = Math.max(
          0,
          Math.round((room.finishedAt.getTime() - room.startedAt.getTime()) / 1000),
        );
        this.observability.recordMatchCompleted(durationSeconds);
      }
      this.persistence.persistMatchSummary(room);
    }

    room.players = room.gameState.players.map((player) => ({
      id: player.id,
      nickname: player.nickname,
      isHost: room.hostId === player.id,
      isReady: true,
      score: computePlayerFinalScore(player),
      hand: player.hand,
      wonPileCount: player.wonPile.length,
      trophyCount: player.trophyCount,
      ...(player.isBot ? { isBot: true as const } : {}),
    }));
    this.persistence.persistRoomSnapshot(room);
  }
}
