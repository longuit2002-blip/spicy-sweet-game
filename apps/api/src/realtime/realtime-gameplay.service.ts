import { Injectable } from "@nestjs/common";
import {
  claimChallenge,
  drawAndPassTurn,
  playCard,
  recordChallengePass,
  resolveChallenge,
} from "@sweet-spicy/game-logic";
import type {
  ChallengeType,
  Declaration,
  SocketActionResult,
  SocketErrorCode,
} from "@sweet-spicy/shared-types";
import {
  SOCKET_ERROR_CODE,
  SOCKET_ERROR_DETAIL_MESSAGE,
  SOCKET_ERROR_MESSAGE,
} from "@sweet-spicy/shared-types";
import { GameBroadcastService } from "../game/game-broadcast.service";
import { RoomObservabilityService } from "../room/room-observability.service";
import { RoomService, type ServerRoom } from "../room/room.service";
import { failureResult, successResult, emitSocketError } from "./realtime-action-result";
import { SocketRateLimiterService } from "./socket-rate-limiter.service";
import { RealtimeSessionService } from "./realtime-session.service";
import type { RealtimeSocket } from "./realtime-socket.types";

type ActiveGameRoom = ServerRoom & { gameState: NonNullable<ServerRoom["gameState"]> };

@Injectable()
export class RealtimeGameplayService {
  constructor(
    private readonly roomService: RoomService,
    private readonly session: RealtimeSessionService,
    private readonly broadcast: GameBroadcastService,
    private readonly rateLimiter: SocketRateLimiterService,
    private readonly observability: RoomObservabilityService,
  ) {}

  handlePlayCard(client: RealtimeSocket, cardId: string, declaration: Declaration): SocketActionResult {
    if (!this.rateLimiter.consume(client.id, "game:play-card")) {
      return this.session.rateLimitFailure(client);
    }

    const roomCode = client.data.roomId;
    const userId = this.session.requireUserId(client);
    if (!roomCode) {
      return failureResult(
        SOCKET_ERROR_CODE.NOT_IN_ROOM,
        SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.NOT_IN_ROOM] as string,
      );
    }

    const room = this.roomService.getRoomByCode(roomCode);
    if (!room?.gameState) {
      return this.invalidFailure(
        client,
        SOCKET_ERROR_CODE.INVALID_PHASE,
        SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.INVALID_PHASE] as string,
      );
    }

    const nextState = playCard(room.gameState, userId, cardId, declaration);
    if (!nextState) {
      return this.invalidFailure(
        client,
        SOCKET_ERROR_CODE.INVALID_MOVE,
        SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.INVALID_MOVE] as string,
      );
    }

    room.gameState = nextState;
    this.roomService.syncRoomPlayersFromGame(room);
    this.broadcast.emitStateUpdate(this.session.getServer(), roomCode, nextState);
    return successResult();
  }

  handleDrawPass(client: RealtimeSocket): SocketActionResult {
    if (!this.rateLimiter.consume(client.id, "game:draw-pass")) {
      return this.session.rateLimitFailure(client);
    }

    const roomCode = client.data.roomId;
    const userId = this.session.requireUserId(client);
    if (!roomCode) {
      return failureResult(
        SOCKET_ERROR_CODE.NOT_IN_ROOM,
        SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.NOT_IN_ROOM] as string,
      );
    }

    const room = this.roomService.getRoomByCode(roomCode);
    if (!room?.gameState) {
      return this.invalidFailure(
        client,
        SOCKET_ERROR_CODE.INVALID_PHASE,
        SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.INVALID_PHASE] as string,
      );
    }

    const nextState = drawAndPassTurn(room.gameState, userId);
    if (!nextState) {
      return this.invalidFailure(
        client,
        SOCKET_ERROR_CODE.INVALID_MOVE,
        SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.INVALID_MOVE] as string,
      );
    }

    room.gameState = nextState;
    this.roomService.syncRoomPlayersFromGame(room);
    this.broadcast.emitStateUpdate(this.session.getServer(), roomCode, nextState);
    return successResult();
  }

  handleClaimChallenge(client: RealtimeSocket): SocketActionResult {
    if (!this.rateLimiter.consume(client.id, "game:claim-challenge")) {
      return this.session.rateLimitFailure(client);
    }

    const room = this.requireGameRoom(client);
    if (!room.ok) {
      return room.result;
    }

    const userId = this.session.requireUserId(client);
    if (room.value.gameState.phase !== "CHALLENGE_PHASE") {
      return this.invalidFailure(
        client,
        SOCKET_ERROR_CODE.INVALID_PHASE,
        SOCKET_ERROR_DETAIL_MESSAGE.CHALLENGE_WRONG_PHASE,
      );
    }
    if (room.value.gameState.playedCard?.playerId === userId) {
      return this.invalidFailure(
        client,
        SOCKET_ERROR_CODE.CANNOT_CHALLENGE_SELF,
        SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.CANNOT_CHALLENGE_SELF] as string,
      );
    }

    const nextState = claimChallenge(room.value.gameState, userId);
    if (!nextState) {
      return this.invalidFailure(
        client,
        SOCKET_ERROR_CODE.INVALID_MOVE,
        SOCKET_ERROR_DETAIL_MESSAGE.CHALLENGE_NOT_AVAILABLE,
      );
    }

    room.value.gameState = nextState;
    this.roomService.syncRoomPlayersFromGame(room.value);
    this.broadcast.emitStateUpdate(this.session.getServer(), room.value.roomCode, nextState);
    return successResult();
  }

  handleChallenge(client: RealtimeSocket, challengeType: ChallengeType): SocketActionResult {
    if (!this.rateLimiter.consume(client.id, "game:challenge")) {
      return this.session.rateLimitFailure(client);
    }

    const room = this.requireGameRoom(client);
    if (!room.ok) {
      return room.result;
    }

    const userId = this.session.requireUserId(client);
    const gameState = room.value.gameState;
    if (gameState.phase !== "CHALLENGE_PHASE") {
      return this.invalidFailure(
        client,
        SOCKET_ERROR_CODE.INVALID_PHASE,
        SOCKET_ERROR_DETAIL_MESSAGE.CHALLENGE_WRONG_PHASE,
      );
    }
    if (gameState.playedCard?.playerId === userId) {
      return this.invalidFailure(
        client,
        SOCKET_ERROR_CODE.CANNOT_CHALLENGE_SELF,
        SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.CANNOT_CHALLENGE_SELF] as string,
      );
    }
    if (gameState.challengeStep !== "PICK_TYPE" || gameState.challengeClaimHolderId !== userId) {
      return this.invalidFailure(
        client,
        SOCKET_ERROR_CODE.INVALID_MOVE,
        SOCKET_ERROR_DETAIL_MESSAGE.CHALLENGE_PICK_NOT_ALLOWED,
      );
    }

    const nextState = resolveChallenge(gameState, userId, challengeType);
    room.value.gameState = nextState;
    this.roomService.syncRoomPlayersFromGame(room.value);
    this.broadcast.emitStateUpdate(this.session.getServer(), room.value.roomCode, nextState);
    if (nextState.challengeResult) {
      this.session.getServer().to(room.value.roomCode).emit("game:challenge-result", nextState.challengeResult);
    }
    return successResult();
  }

  handleChallengePass(client: RealtimeSocket): SocketActionResult {
    if (!this.rateLimiter.consume(client.id, "game:challenge-pass")) {
      return this.session.rateLimitFailure(client);
    }

    return this.recordChallengePass(client);
  }

  handleAccept(client: RealtimeSocket): SocketActionResult {
    if (!this.rateLimiter.consume(client.id, "game:accept")) {
      return this.session.rateLimitFailure(client);
    }

    return this.recordChallengePass(client);
  }

  private recordChallengePass(client: RealtimeSocket): SocketActionResult {
    const room = this.requireGameRoom(client);
    if (!room.ok) {
      return room.result;
    }

    const userId = this.session.requireUserId(client);
    const gameState = room.value.gameState;
    if (gameState.phase !== "CHALLENGE_PHASE") {
      return this.invalidFailure(
        client,
        SOCKET_ERROR_CODE.INVALID_PHASE,
        SOCKET_ERROR_DETAIL_MESSAGE.ACCEPT_WRONG_PHASE,
      );
    }
    if (gameState.challengeStep === "PICK_TYPE") {
      return this.invalidFailure(
        client,
        SOCKET_ERROR_CODE.INVALID_MOVE,
        SOCKET_ERROR_DETAIL_MESSAGE.ACCEPT_DURING_PICK_NOT_ALLOWED,
      );
    }
    if (gameState.playedCard?.playerId === userId) {
      return this.invalidFailure(
        client,
        SOCKET_ERROR_CODE.CANNOT_ACCEPT_SELF,
        SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.CANNOT_ACCEPT_SELF] as string,
      );
    }

    const nextState = recordChallengePass(gameState, userId);
    if (nextState == null) {
      return this.invalidFailure(
        client,
        SOCKET_ERROR_CODE.INVALID_MOVE,
        SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.INVALID_MOVE] as string,
      );
    }
    if (nextState === gameState) {
      return successResult();
    }

    room.value.gameState = nextState;
    this.roomService.syncRoomPlayersFromGame(room.value);
    this.broadcast.emitStateUpdate(this.session.getServer(), room.value.roomCode, nextState);
    return successResult();
  }

  private requireGameRoom(client: RealtimeSocket):
    | { ok: true; value: ActiveGameRoom }
    | { ok: false; result: SocketActionResult } {
    const roomCode = client.data.roomId;
    if (!roomCode) {
      return {
        ok: false,
        result: failureResult(
          SOCKET_ERROR_CODE.NOT_IN_ROOM,
          SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.NOT_IN_ROOM] as string,
        ),
      };
    }

    const room = this.roomService.getRoomByCode(roomCode);
    if (!room?.gameState) {
      return {
        ok: false,
        result: this.invalidFailure(
          client,
          SOCKET_ERROR_CODE.INVALID_PHASE,
          SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.INVALID_PHASE] as string,
        ),
      };
    }

    return { ok: true, value: room as ActiveGameRoom };
  }

  private invalidFailure(
    client: RealtimeSocket,
    code: SocketErrorCode,
    message: string,
  ): SocketActionResult {
    this.observability.recordInvalidMove();
    emitSocketError(client, code, message);
    return failureResult(code, message);
  }
}
