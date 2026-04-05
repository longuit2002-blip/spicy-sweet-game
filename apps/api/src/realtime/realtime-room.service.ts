import { Injectable } from "@nestjs/common";
import {
  DEFAULT_ROOM_MAX_PLAYERS,
  SOCKET_ERROR_CODE,
  SOCKET_ERROR_DETAIL_MESSAGE,
  SOCKET_ERROR_MESSAGE,
  type CreateRoomResult,
  type JoinResult,
  type SocketActionResult,
} from "@sweet-spicy/shared-types";
import { toClientGameState } from "@sweet-spicy/game-logic";
import { GameBroadcastService } from "../game/game-broadcast.service";
import { RoomService } from "../room/room.service";
import { SocketRateLimiterService } from "./socket-rate-limiter.service";
import { RealtimeSessionService } from "./realtime-session.service";
import type { RealtimeSocket } from "./realtime-socket.types";
import { failureResult, successResult } from "./realtime-action-result";
import { parseRoomJoinCode } from "./parse-room-join";
import { emitSocketError } from "./realtime-action-result";

@Injectable()
export class RealtimeRoomService {
  constructor(
    private readonly roomService: RoomService,
    private readonly session: RealtimeSessionService,
    private readonly broadcast: GameBroadcastService,
    private readonly rateLimiter: SocketRateLimiterService,
  ) {}

  handleCreate(client: RealtimeSocket, maxPlayers: number | undefined): CreateRoomResult {
    if (!this.rateLimiter.consume(client.id, "room:create")) {
      return this.session.rateLimitFailure(client);
    }

    const userId = this.session.requireUserId(client);
    const nickname = this.session.requireNickname(client);
    const { room, previousExit } = this.roomService.createRoom(
      userId,
      nickname,
      maxPlayers ?? DEFAULT_ROOM_MAX_PLAYERS,
    );

    if (previousExit?.roomCode) {
      this.session.finalizeRoomExit(userId, previousExit);
    }

    void client.join(room.roomCode);
    client.data.roomId = room.roomCode;
    const state = this.roomService.toRoomState(room);
    client.emit("room:joined", state);
    return successResult({ room: state });
  }

  handleJoin(client: RealtimeSocket, payload: unknown): JoinResult {
    if (!this.rateLimiter.consume(client.id, "room:join")) {
      const rateLimitFailure = this.session.rateLimitFailure(client);
      return {
        success: false,
        code: rateLimitFailure.code,
        message: rateLimitFailure.message,
      };
    }

    const code = parseRoomJoinCode(payload);
    if (!code) {
      emitSocketError(client, SOCKET_ERROR_CODE.INVALID_PAYLOAD, SOCKET_ERROR_DETAIL_MESSAGE.INVALID_ROOM_CODE);
      return {
        success: false,
        code: SOCKET_ERROR_CODE.INVALID_PAYLOAD,
        message: SOCKET_ERROR_DETAIL_MESSAGE.INVALID_ROOM_CODE,
      };
    }

    const userId = this.session.requireUserId(client);
    const nickname = this.session.requireNickname(client);
    const result = this.roomService.joinRoom(code, userId, nickname);
    if (!result.ok) {
      return { success: false, code: result.code, message: result.message };
    }

    if (result.previousExit?.roomCode) {
      this.session.finalizeRoomExit(userId, result.previousExit);
    }

    void client.join(result.room.roomCode);
    client.data.roomId = result.room.roomCode;
    const state = this.roomService.toRoomState(result.room);
    if (!result.resumed) {
      const joinedPlayer = state.players.find((player) => player.id === userId);
      if (joinedPlayer) {
        client.to(result.room.roomCode).emit("room:player-joined", joinedPlayer);
      }
    }
    client.emit("room:joined", state);
    if (result.resumed && result.room.gameState) {
      client.emit("game:state-update", toClientGameState(result.room.gameState, userId));
    }

    return successResult({
      room: state,
      ...(result.resumed ? { resumed: true } : {}),
    });
  }

  handleLeave(client: RealtimeSocket): SocketActionResult {
    if (!this.rateLimiter.consume(client.id, "room:leave")) {
      return this.session.rateLimitFailure(client);
    }

    const userId = this.session.requireUserId(client);
    const room = this.roomService.getRoomForUser(userId);
    if (!room) {
      return failureResult(
        SOCKET_ERROR_CODE.NOT_IN_ROOM,
        SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.NOT_IN_ROOM] as string,
      );
    }

    const leaveResult = room.gameState
      ? this.roomService.handoffUserToBot(userId)
      : this.roomService.leaveRoom(userId);
    this.session.finalizeRoomExit(userId, leaveResult);
    return successResult();
  }

  handleReady(client: RealtimeSocket, ready: boolean): SocketActionResult {
    if (!this.rateLimiter.consume(client.id, "room:ready")) {
      return this.session.rateLimitFailure(client);
    }

    const userId = this.session.requireUserId(client);
    const result = this.roomService.setReady(userId, ready);
    if (!result.ok) {
      emitSocketError(client, result.code, result.message);
      return failureResult(result.code, result.message);
    }

    client.nsp.to(result.room.roomCode).emit("room:player-ready", { playerId: userId, ready });
    return successResult();
  }

  handleAddBot(client: RealtimeSocket) {
    if (!this.rateLimiter.consume(client.id, "room:add-bot")) {
      return this.session.rateLimitFailure(client);
    }

    const userId = this.session.requireUserId(client);
    const result = this.roomService.addLobbyBot(userId, client.data.roomId);
    if (!result.ok) {
      return failureResult(result.code, result.message);
    }

    const roomState = this.roomService.toRoomState(result.room);
    const botPlayer =
      roomState.players.find((player) => player.id === result.player.id) ?? result.player;
    client.nsp.to(result.room.roomCode).emit("room:player-joined", botPlayer);
    return successResult({ room: roomState, player: botPlayer });
  }

  handleStart(client: RealtimeSocket): SocketActionResult {
    if (!this.rateLimiter.consume(client.id, "room:start")) {
      return this.session.rateLimitFailure(client);
    }

    const userId = this.session.requireUserId(client);
    const result = this.roomService.startGame(userId);
    if (!result.ok) {
      emitSocketError(client, result.code, result.message);
      return failureResult(result.code, result.message);
    }

    if (result.room.gameState) {
      this.broadcast.emitGameStart(this.session.getServer(), result.room.roomCode, result.room.gameState);
    }

    return successResult();
  }
}
