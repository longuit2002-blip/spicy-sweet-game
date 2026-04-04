import { UsePipes, ValidationPipe } from "@nestjs/common";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { JwtService } from "@nestjs/jwt";
import {
  claimChallenge,
  drawAndPassTurn,
  playCard,
  recordChallengePass,
  resolveChallenge,
  toClientGameState,
} from "@sweet-spicy/game-logic";
import type {
  Declaration,
  MediaParticipant,
  MediaSignalAnswer,
  MediaSignalIceCandidate,
  MediaSignalOffer,
  SocketActionResult,
  SocketErrorCode,
} from "@sweet-spicy/shared-types";
import {
  CHAT_MESSAGE_MAX_LENGTH,
  DEFAULT_ROOM_MAX_PLAYERS,
  SOCKET_ERROR_CODE,
  SOCKET_ERROR_DETAIL_MESSAGE,
  SOCKET_ERROR_MESSAGE,
} from "@sweet-spicy/shared-types";
import { RoomService } from "../room/room.service";
import { GameLoopService } from "../game/game-loop.service";
import { GameBotDriverService } from "../game/game-bot-driver.service";
import { GameBroadcastService } from "../game/game-broadcast.service";
import { SocketRateLimiterService } from "./socket-rate-limiter.service";
import { RoomCreateDto } from "./dto/room-create.dto";
import { PlayCardDto } from "./dto/play-card.dto";
import { ChatSendDto } from "./dto/chat-send.dto";
import { ChallengeDto } from "./dto/challenge.dto";
import { WebrtcJoinRoomDto } from "./dto/webrtc-join-room.dto";
import { WebrtcMediaStateDto } from "./dto/webrtc-media-state.dto";
import { MediaConfigService } from "./media-config.service";
import { MediaPresenceService } from "./media-presence.service";
import { parseRoomJoinCode } from "./parse-room-join";
import type { RealtimeServer, RealtimeSocket } from "./realtime-socket.types";

const SOCKET_VALIDATION_PIPE = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: false,
});

const DISCONNECT_GRACE_PERIOD_MS = 5_000;

@WebSocketGateway({
  cors: { origin: process.env.CLIENT_URL ?? "*", credentials: true },
  transports: ["websocket", "polling"],
})
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: RealtimeServer;
  private readonly activeSocketIdsByUser = new Map<string, Set<string>>();
  private readonly disconnectTimersByUser = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly mediaDisconnectTimersBySocket = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    private readonly jwt: JwtService,
    private readonly roomService: RoomService,
    private readonly gameLoop: GameLoopService,
    private readonly gameBotDriver: GameBotDriverService,
    private readonly broadcast: GameBroadcastService,
    private readonly rateLimiter: SocketRateLimiterService,
    private readonly mediaConfig: MediaConfigService,
    private readonly mediaPresence: MediaPresenceService,
  ) {}

  private emitSocketError(client: RealtimeSocket, code: SocketErrorCode, message: string): void {
    client.emit("error", { code, message });
  }

  private successResult<T extends object = Record<never, never>>(extra?: T): { success: true } & T {
    return { success: true, ...(extra ?? {}) } as { success: true } & T;
  }

  private failureResult(code: SocketErrorCode, message: string): SocketActionResult {
    return { success: false, code, message };
  }

  private emitRateLimit(client: RealtimeSocket): void {
    this.emitSocketError(
      client,
      SOCKET_ERROR_CODE.RATE_LIMIT,
      SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.RATE_LIMIT] as string,
    );
  }

  afterInit(server: RealtimeServer) {
    this.gameLoop.attachServer(server);
    this.gameBotDriver.attachServer(server);
    server.use((socket, next) => {
      try {
        const token = socket.handshake.auth?.token as string | undefined;
        if (!token) {
          return next(new Error("Unauthorized"));
        }
        const p = this.jwt.verify<{ sub: string; nickname: string }>(token);
        socket.data.userId = p.sub;
        socket.data.nickname = p.nickname;
        next();
      } catch {
        next(new Error("Unauthorized"));
      }
    });
  }

  handleConnection(client: RealtimeSocket): void {
    const userId = client.data.userId;
    if (!userId) {
      return;
    }
    const activeSocketIds = this.activeSocketIdsByUser.get(userId) ?? new Set<string>();
    activeSocketIds.add(client.id);
    this.activeSocketIdsByUser.set(userId, activeSocketIds);
    const pendingDisconnect = this.disconnectTimersByUser.get(userId);
    if (pendingDisconnect) {
      clearTimeout(pendingDisconnect);
      this.disconnectTimersByUser.delete(userId);
    }
  }

  handleDisconnect(client: RealtimeSocket): void {
    const userId = client.data.userId;
    if (!userId) {
      return;
    }
    this.scheduleMediaDisconnect(client.id);
    const activeSocketIds = this.activeSocketIdsByUser.get(userId);
    if (activeSocketIds) {
      activeSocketIds.delete(client.id);
      if (activeSocketIds.size === 0) {
        this.activeSocketIdsByUser.delete(userId);
      }
    }
    if (this.activeSocketIdsByUser.has(userId)) {
      return;
    }
    if (this.disconnectTimersByUser.has(userId)) {
      clearTimeout(this.disconnectTimersByUser.get(userId));
    }
    const timer = setTimeout(() => {
      this.disconnectTimersByUser.delete(userId);
      this.leaveUserFromCurrentRoom(userId);
    }, DISCONNECT_GRACE_PERIOD_MS);
    this.disconnectTimersByUser.set(userId, timer);
  }

  private getActiveSocketsForUser(userId: string): RealtimeSocket[] {
    const activeSocketIds = this.activeSocketIdsByUser.get(userId);
    if (!activeSocketIds) {
      return [];
    }
    return Array.from(activeSocketIds)
      .map((socketId) => this.server.sockets.sockets.get(socketId))
      .filter((socket): socket is RealtimeSocket => socket !== undefined);
  }

  private getActiveSocketIdsForUser(userId: string): ReadonlySet<string> {
    return this.activeSocketIdsByUser.get(userId) ?? new Set<string>();
  }

  private clearRoomMembershipFromActiveSockets(userId: string, roomCode: string): void {
    for (const socket of this.getActiveSocketsForUser(userId)) {
      void socket.leave(roomCode);
      socket.data.roomId = undefined;
    }
  }

  private broadcastLeaveResult(userId: string, leaveResult: import("../room/room.service").LeaveRoomResult): void {
    if (!leaveResult.roomCode || !leaveResult.room) {
      return;
    }
    this.server.to(leaveResult.roomCode).emit("room:player-left", { playerId: userId });
    if (leaveResult.newHostId) {
      this.server.to(leaveResult.roomCode).emit("room:host-changed", {
        newHostId: leaveResult.newHostId,
      });
    }
  }

  private finalizeRoomExit(userId: string, leaveResult: import("../room/room.service").LeaveRoomResult): void {
    if (!leaveResult.roomCode) {
      return;
    }

    const mediaParticipant = this.mediaPresence.leaveRoom(leaveResult.roomCode, userId);
    if (mediaParticipant) {
      this.server.to(leaveResult.roomCode).emit("webrtc:peer-left", { peerId: mediaParticipant.peerId });
    }
    this.clearRoomMembershipFromActiveSockets(userId, leaveResult.roomCode);

    if (leaveResult.handedOffToBot && leaveResult.room?.gameState) {
      this.broadcast.emitStateUpdate(this.server, leaveResult.roomCode, leaveResult.room.gameState);
      return;
    }

    this.broadcastLeaveResult(userId, leaveResult);
  }

  private leaveUserFromCurrentRoom(userId: string): void {
    const room = this.roomService.getRoomForUser(userId);
    const leaveResult = room?.gameState
      ? this.roomService.handoffUserToBot(userId)
      : this.roomService.leaveRoom(userId);

    this.finalizeRoomExit(userId, leaveResult);
  }

  private getResolvedRoomCode(client: RealtimeSocket, requestedRoomCode?: string): string | null {
    if (requestedRoomCode && requestedRoomCode.trim().length > 0) {
      return requestedRoomCode.trim().toUpperCase();
    }

    const userId = client.data.userId;
    if (!userId) {
      return null;
    }

    const roomForUser = this.roomService.getRoomForUser(userId);
    if (roomForUser) {
      return roomForUser.roomCode;
    }

    const socketRoomCode = client.data.roomId;
    return socketRoomCode?.toUpperCase() ?? null;
  }

  private getRoomForMediaAction(client: RealtimeSocket, requestedRoomCode?: string) {
    const roomCode = this.getResolvedRoomCode(client, requestedRoomCode);
    if (!roomCode) {
      return null;
    }

    return this.roomService.getRoomByCode(roomCode) ?? null;
  }

  private requireUserId(client: RealtimeSocket): string {
    const userId = client.data.userId;
    if (!userId) {
      throw new Error("Unauthorized");
    }

    return userId;
  }

  private requireNickname(client: RealtimeSocket): string {
    const nickname = client.data.nickname;
    if (!nickname) {
      throw new Error("Unauthorized");
    }

    return nickname;
  }

  private emitToMediaPeer<K extends "webrtc:offer" | "webrtc:answer" | "webrtc:ice-candidate">(
    roomCode: string,
    peerId: string,
    event: K,
    ...payload: Parameters<import("@sweet-spicy/shared-types").ServerToClientEvents[K]>
  ): boolean {
    const targetSocketId = this.mediaPresence.getParticipantSocketId(roomCode, peerId);
    if (!targetSocketId) {
      return false;
    }

    const targetSocket = this.getActiveSocketsForUser(peerId).find((socket) => socket.id === targetSocketId);
    if (!targetSocket) {
      return false;
    }

    targetSocket.emit(event, ...payload);
    return true;
  }

  private emitMediaState(roomCode: string, participant: MediaParticipant): void {
    this.server.to(roomCode).emit("webrtc:peer-media-state", {
      peerId: participant.peerId,
      audioEnabled: participant.audioEnabled,
      videoEnabled: participant.videoEnabled,
    });
  }

  private scheduleMediaDisconnect(socketId: string): void {
    const roomCode = this.mediaPresence.getRoomCodeForSocket(socketId);
    if (!roomCode) {
      return;
    }

    const existingTimer = this.mediaDisconnectTimersBySocket.get(socketId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      this.mediaDisconnectTimersBySocket.delete(socketId);
      const participant = this.mediaPresence.leaveBySocket(socketId);
      if (!participant) {
        return;
      }

      this.server.to(roomCode).emit("webrtc:peer-left", { peerId: participant.peerId });
    }, DISCONNECT_GRACE_PERIOD_MS);

    this.mediaDisconnectTimersBySocket.set(socketId, timer);
  }

  private clearMediaDisconnectTimer(socketId: string): void {
    const timer = this.mediaDisconnectTimersBySocket.get(socketId);
    if (!timer) {
      return;
    }

    clearTimeout(timer);
    this.mediaDisconnectTimersBySocket.delete(socketId);
  }

  @SubscribeMessage("room:create")
  @UsePipes(SOCKET_VALIDATION_PIPE)
  handleCreate(@ConnectedSocket() client: RealtimeSocket, @MessageBody() data: RoomCreateDto) {
    if (!this.rateLimiter.consume(client.id, "room:create")) {
      this.emitRateLimit(client);
      return this.failureResult(
        SOCKET_ERROR_CODE.RATE_LIMIT,
        SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.RATE_LIMIT] as string,
      );
    }
    const userId = this.requireUserId(client);
    const nickname = this.requireNickname(client);
    const { room, previousExit } = this.roomService.createRoom(
      userId,
      nickname,
      data.maxPlayers ?? DEFAULT_ROOM_MAX_PLAYERS,
    );
    if (previousExit?.roomCode) {
      this.finalizeRoomExit(userId, previousExit);
    }
    void client.join(room.roomCode);
    client.data.roomId = room.roomCode;
    const state = this.roomService.toRoomState(room);
    client.emit("room:joined", state);
    return this.successResult({
      room: state,
    });
  }

  @SubscribeMessage("room:join")
  handleJoin(@ConnectedSocket() client: RealtimeSocket, @MessageBody() payload: unknown) {
    if (!this.rateLimiter.consume(client.id, "room:join")) {
      this.emitRateLimit(client);
      return this.failureResult(
        SOCKET_ERROR_CODE.RATE_LIMIT,
        SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.RATE_LIMIT] as string,
      );
    }
    const code = parseRoomJoinCode(payload);
    if (!code) {
      this.emitSocketError(client, SOCKET_ERROR_CODE.INVALID_PAYLOAD, SOCKET_ERROR_DETAIL_MESSAGE.INVALID_ROOM_CODE);
      return this.failureResult(SOCKET_ERROR_CODE.INVALID_PAYLOAD, SOCKET_ERROR_DETAIL_MESSAGE.INVALID_ROOM_CODE);
    }
    const userId = this.requireUserId(client);
    const nickname = this.requireNickname(client);
    const result = this.roomService.joinRoom(code, userId, nickname);
    if (!result.ok) {
      return this.failureResult(result.code, result.message);
    }
    if (result.previousExit?.roomCode) {
      this.finalizeRoomExit(userId, result.previousExit);
    }
    void client.join(result.room.roomCode);
    client.data.roomId = result.room.roomCode;
    const state = this.roomService.toRoomState(result.room);
    if (!result.resumed) {
      const joined = state.players.find((p) => p.id === userId)!;
      client.to(result.room.roomCode).emit("room:player-joined", joined);
    }
    client.emit("room:joined", state);
    if (result.resumed && result.room.gameState) {
      client.emit("game:state-update", toClientGameState(result.room.gameState, userId));
    }
    return this.successResult({
      room: state,
      ...(result.resumed ? { resumed: true } : {}),
    });
  }

  @SubscribeMessage("room:leave")
  handleLeave(@ConnectedSocket() client: RealtimeSocket) {
    if (!this.rateLimiter.consume(client.id, "room:leave")) {
      this.emitRateLimit(client);
      return this.failureResult(
        SOCKET_ERROR_CODE.RATE_LIMIT,
        SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.RATE_LIMIT] as string,
      );
    }
    const userId = this.requireUserId(client);
    const room = this.roomService.getRoomForUser(userId);
    if (!room) {
      return this.failureResult(
        SOCKET_ERROR_CODE.NOT_IN_ROOM,
        SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.NOT_IN_ROOM] as string,
      );
    }
    const leaveResult = room.gameState
      ? this.roomService.handoffUserToBot(userId)
      : this.roomService.leaveRoom(userId);
    this.finalizeRoomExit(userId, leaveResult);
    return this.successResult();
  }

  @SubscribeMessage("room:ready")
  handleReady(@ConnectedSocket() client: RealtimeSocket, @MessageBody() ready: unknown) {
    if (!this.rateLimiter.consume(client.id, "room:ready")) {
      this.emitRateLimit(client);
      return this.failureResult(
        SOCKET_ERROR_CODE.RATE_LIMIT,
        SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.RATE_LIMIT] as string,
      );
    }
    if (typeof ready !== "boolean") {
      this.emitSocketError(client, SOCKET_ERROR_CODE.INVALID_PAYLOAD, SOCKET_ERROR_DETAIL_MESSAGE.READY_NOT_BOOLEAN);
      return this.failureResult(SOCKET_ERROR_CODE.INVALID_PAYLOAD, SOCKET_ERROR_DETAIL_MESSAGE.READY_NOT_BOOLEAN);
    }
    const userId = this.requireUserId(client);
    const room = this.roomService.setReady(userId, ready);
    if (!room.ok) {
      this.emitSocketError(client, room.code, room.message);
      return this.failureResult(room.code, room.message);
    }
    const roomCode = room.room.roomCode;
    this.server.to(roomCode).emit("room:player-ready", { playerId: userId, ready });
    return this.successResult();
  }

  @SubscribeMessage("room:add-bot")
  handleAddBot(@ConnectedSocket() client: RealtimeSocket) {
    if (!this.rateLimiter.consume(client.id, "room:add-bot")) {
      this.emitRateLimit(client);
      return this.failureResult(
        SOCKET_ERROR_CODE.RATE_LIMIT,
        SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.RATE_LIMIT] as string,
      );
    }
    const userId = this.requireUserId(client);
    const socketRoomCode = client.data.roomId;
    const result = this.roomService.addLobbyBot(userId, socketRoomCode);
    if (!result.ok) {
      return this.failureResult(result.code, result.message);
    }
    const roomCode = result.room.roomCode;
    const state = this.roomService.toRoomState(result.room);
    const bot = state.players.find((player) => player.id === result.player.id) ?? result.player;
    this.server.to(roomCode).emit("room:player-joined", bot);
    return this.successResult({ room: state, player: bot });
  }

  @SubscribeMessage("room:start")
  handleStart(@ConnectedSocket() client: RealtimeSocket) {
    if (!this.rateLimiter.consume(client.id, "room:start")) {
      this.emitRateLimit(client);
      return this.failureResult(
        SOCKET_ERROR_CODE.RATE_LIMIT,
        SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.RATE_LIMIT] as string,
      );
    }
    const userId = this.requireUserId(client);
    const result = this.roomService.startGame(userId);
    if (!result.ok) {
      this.emitSocketError(client, result.code, result.message);
      return this.failureResult(result.code, result.message);
    }
    const room = result.room;
    if (room.gameState) {
      this.broadcast.emitGameStart(this.server, room.roomCode, room.gameState);
    }
    return this.successResult();
  }

  @SubscribeMessage("game:play-card")
  @UsePipes(SOCKET_VALIDATION_PIPE)
  handlePlayCard(@ConnectedSocket() client: RealtimeSocket, @MessageBody() data: PlayCardDto) {
    if (!this.rateLimiter.consume(client.id, "game:play-card")) {
      this.emitRateLimit(client);
      return this.failureResult(
        SOCKET_ERROR_CODE.RATE_LIMIT,
        SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.RATE_LIMIT] as string,
      );
    }
    const roomCode = client.data.roomId;
    const userId = this.requireUserId(client);
    if (!roomCode) {
      return this.failureResult(
        SOCKET_ERROR_CODE.NOT_IN_ROOM,
        SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.NOT_IN_ROOM] as string,
      );
    }
    const room = this.roomService.getRoomByCode(roomCode);
    if (!room?.gameState) {
      return this.failureResult(SOCKET_ERROR_CODE.INVALID_PHASE, SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.INVALID_PHASE] as string);
    }
    const decl = data.declaration as Declaration;
    const next = playCard(room.gameState, userId, data.cardId, decl);
    if (!next) {
      this.emitSocketError(
        client,
        SOCKET_ERROR_CODE.INVALID_MOVE,
        SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.INVALID_MOVE] as string,
      );
      return this.failureResult(
        SOCKET_ERROR_CODE.INVALID_MOVE,
        SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.INVALID_MOVE] as string,
      );
    }
    room.gameState = next;
    this.syncRoomPlayers(room);
    this.broadcast.emitStateUpdate(this.server, roomCode, next);
    return this.successResult();
  }

  @SubscribeMessage("game:draw-pass")
  handleDrawPass(@ConnectedSocket() client: RealtimeSocket) {
    if (!this.rateLimiter.consume(client.id, "game:draw-pass")) {
      this.emitRateLimit(client);
      return this.failureResult(
        SOCKET_ERROR_CODE.RATE_LIMIT,
        SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.RATE_LIMIT] as string,
      );
    }
    const roomCode = client.data.roomId;
    const userId = this.requireUserId(client);
    if (!roomCode) {
      return this.failureResult(
        SOCKET_ERROR_CODE.NOT_IN_ROOM,
        SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.NOT_IN_ROOM] as string,
      );
    }
    const room = this.roomService.getRoomByCode(roomCode);
    if (!room?.gameState) {
      return this.failureResult(SOCKET_ERROR_CODE.INVALID_PHASE, SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.INVALID_PHASE] as string);
    }
    const next = drawAndPassTurn(room.gameState, userId);
    if (!next) {
      this.emitSocketError(
        client,
        SOCKET_ERROR_CODE.INVALID_MOVE,
        SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.INVALID_MOVE] as string,
      );
      return this.failureResult(
        SOCKET_ERROR_CODE.INVALID_MOVE,
        SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.INVALID_MOVE] as string,
      );
    }
    room.gameState = next;
    this.syncRoomPlayers(room);
    this.broadcast.emitStateUpdate(this.server, roomCode, next);
    return this.successResult();
  }

  @SubscribeMessage("game:claim-challenge")
  handleClaimChallenge(@ConnectedSocket() client: RealtimeSocket) {
    if (!this.rateLimiter.consume(client.id, "game:claim-challenge")) {
      this.emitRateLimit(client);
      return this.failureResult(
        SOCKET_ERROR_CODE.RATE_LIMIT,
        SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.RATE_LIMIT] as string,
      );
    }
    const roomCode = client.data.roomId;
    const userId = this.requireUserId(client);
    if (!roomCode) {
      return this.failureResult(
        SOCKET_ERROR_CODE.NOT_IN_ROOM,
        SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.NOT_IN_ROOM] as string,
      );
    }
    const room = this.roomService.getRoomByCode(roomCode);
    if (!room?.gameState) {
      return this.failureResult(SOCKET_ERROR_CODE.INVALID_PHASE, SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.INVALID_PHASE] as string);
    }
    if (room.gameState.phase !== "CHALLENGE_PHASE") {
      this.emitSocketError(client, SOCKET_ERROR_CODE.INVALID_PHASE, SOCKET_ERROR_DETAIL_MESSAGE.CHALLENGE_WRONG_PHASE);
      return this.failureResult(SOCKET_ERROR_CODE.INVALID_PHASE, SOCKET_ERROR_DETAIL_MESSAGE.CHALLENGE_WRONG_PHASE);
    }
    if (room.gameState.playedCard?.playerId === userId) {
      this.emitSocketError(
        client,
        SOCKET_ERROR_CODE.CANNOT_CHALLENGE_SELF,
        SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.CANNOT_CHALLENGE_SELF] as string,
      );
      return this.failureResult(
        SOCKET_ERROR_CODE.CANNOT_CHALLENGE_SELF,
        SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.CANNOT_CHALLENGE_SELF] as string,
      );
    }
    const next = claimChallenge(room.gameState, userId);
    if (!next) {
      this.emitSocketError(client, SOCKET_ERROR_CODE.INVALID_MOVE, SOCKET_ERROR_DETAIL_MESSAGE.CHALLENGE_NOT_AVAILABLE);
      return this.failureResult(SOCKET_ERROR_CODE.INVALID_MOVE, SOCKET_ERROR_DETAIL_MESSAGE.CHALLENGE_NOT_AVAILABLE);
    }
    room.gameState = next;
    this.syncRoomPlayers(room);
    this.broadcast.emitStateUpdate(this.server, roomCode, next);
    return this.successResult();
  }

  @SubscribeMessage("game:challenge")
  @UsePipes(SOCKET_VALIDATION_PIPE)
  handleChallenge(@ConnectedSocket() client: RealtimeSocket, @MessageBody() data: ChallengeDto) {
    if (!this.rateLimiter.consume(client.id, "game:challenge")) {
      this.emitRateLimit(client);
      return this.failureResult(
        SOCKET_ERROR_CODE.RATE_LIMIT,
        SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.RATE_LIMIT] as string,
      );
    }
    const roomCode = client.data.roomId;
    const userId = this.requireUserId(client);
    if (!roomCode) {
      return this.failureResult(
        SOCKET_ERROR_CODE.NOT_IN_ROOM,
        SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.NOT_IN_ROOM] as string,
      );
    }
    const room = this.roomService.getRoomByCode(roomCode);
    if (!room?.gameState) {
      return this.failureResult(SOCKET_ERROR_CODE.INVALID_PHASE, SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.INVALID_PHASE] as string);
    }
    if (room.gameState.phase !== "CHALLENGE_PHASE") {
      this.emitSocketError(client, SOCKET_ERROR_CODE.INVALID_PHASE, SOCKET_ERROR_DETAIL_MESSAGE.CHALLENGE_WRONG_PHASE);
      return this.failureResult(SOCKET_ERROR_CODE.INVALID_PHASE, SOCKET_ERROR_DETAIL_MESSAGE.CHALLENGE_WRONG_PHASE);
    }
    if (room.gameState.playedCard?.playerId === userId) {
      this.emitSocketError(
        client,
        SOCKET_ERROR_CODE.CANNOT_CHALLENGE_SELF,
        SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.CANNOT_CHALLENGE_SELF] as string,
      );
      return this.failureResult(
        SOCKET_ERROR_CODE.CANNOT_CHALLENGE_SELF,
        SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.CANNOT_CHALLENGE_SELF] as string,
      );
    }
    if (
      room.gameState.challengeStep !== "PICK_TYPE" ||
      room.gameState.challengeClaimHolderId !== userId
    ) {
      this.emitSocketError(client, SOCKET_ERROR_CODE.INVALID_MOVE, SOCKET_ERROR_DETAIL_MESSAGE.CHALLENGE_PICK_NOT_ALLOWED);
      return this.failureResult(SOCKET_ERROR_CODE.INVALID_MOVE, SOCKET_ERROR_DETAIL_MESSAGE.CHALLENGE_PICK_NOT_ALLOWED);
    }
    const next = resolveChallenge(room.gameState, userId, data.challengeType);
    room.gameState = next;
    this.syncRoomPlayers(room);
    this.broadcast.emitStateUpdate(this.server, roomCode, next);
    if (next.challengeResult) {
      this.server.to(roomCode).emit("game:challenge-result", next.challengeResult);
    }
    return this.successResult();
  }

  @SubscribeMessage("game:challenge-pass")
  handleChallengePass(@ConnectedSocket() client: RealtimeSocket) {
    if (!this.rateLimiter.consume(client.id, "game:challenge-pass")) {
      this.emitRateLimit(client);
      return this.failureResult(
        SOCKET_ERROR_CODE.RATE_LIMIT,
        SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.RATE_LIMIT] as string,
      );
    }
    return this.tryRecordChallengePass(client);
  }

  @SubscribeMessage("game:accept")
  handleAccept(@ConnectedSocket() client: RealtimeSocket) {
    if (!this.rateLimiter.consume(client.id, "game:accept")) {
      this.emitRateLimit(client);
      return this.failureResult(
        SOCKET_ERROR_CODE.RATE_LIMIT,
        SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.RATE_LIMIT] as string,
      );
    }
    return this.tryRecordChallengePass(client);
  }

  /**
   * During CLAIM_RACE, registers a pass (same as legacy `game:accept` during this sub-step).
   * Rejects during PICK_TYPE so observers cannot cancel the holder's pick.
   */
  private tryRecordChallengePass(client: RealtimeSocket): SocketActionResult {
    const roomCode = client.data.roomId;
    const userId = this.requireUserId(client);
    if (!roomCode) {
      return this.failureResult(
        SOCKET_ERROR_CODE.NOT_IN_ROOM,
        SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.NOT_IN_ROOM] as string,
      );
    }
    const room = this.roomService.getRoomByCode(roomCode);
    if (!room?.gameState) {
      return this.failureResult(SOCKET_ERROR_CODE.INVALID_PHASE, SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.INVALID_PHASE] as string);
    }
    if (room.gameState.phase !== "CHALLENGE_PHASE") {
      this.emitSocketError(client, SOCKET_ERROR_CODE.INVALID_PHASE, SOCKET_ERROR_DETAIL_MESSAGE.ACCEPT_WRONG_PHASE);
      return this.failureResult(SOCKET_ERROR_CODE.INVALID_PHASE, SOCKET_ERROR_DETAIL_MESSAGE.ACCEPT_WRONG_PHASE);
    }
    if (room.gameState.challengeStep === "PICK_TYPE") {
      this.emitSocketError(client, SOCKET_ERROR_CODE.INVALID_MOVE, SOCKET_ERROR_DETAIL_MESSAGE.ACCEPT_DURING_PICK_NOT_ALLOWED);
      return this.failureResult(SOCKET_ERROR_CODE.INVALID_MOVE, SOCKET_ERROR_DETAIL_MESSAGE.ACCEPT_DURING_PICK_NOT_ALLOWED);
    }
    if (room.gameState.playedCard?.playerId === userId) {
      this.emitSocketError(
        client,
        SOCKET_ERROR_CODE.CANNOT_ACCEPT_SELF,
        SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.CANNOT_ACCEPT_SELF] as string,
      );
      return this.failureResult(
        SOCKET_ERROR_CODE.CANNOT_ACCEPT_SELF,
        SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.CANNOT_ACCEPT_SELF] as string,
      );
    }
    const next = recordChallengePass(room.gameState, userId);
    if (next == null) {
      this.emitSocketError(client, SOCKET_ERROR_CODE.INVALID_MOVE, SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.INVALID_MOVE] as string);
      return this.failureResult(
        SOCKET_ERROR_CODE.INVALID_MOVE,
        SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.INVALID_MOVE] as string,
      );
    }
    if (next === room.gameState) {
      return this.successResult();
    }
    room.gameState = next;
    this.syncRoomPlayers(room);
    this.broadcast.emitStateUpdate(this.server, roomCode, next);
    return this.successResult();
  }

  @SubscribeMessage("chat:send")
  @UsePipes(SOCKET_VALIDATION_PIPE)
  handleChat(@ConnectedSocket() client: RealtimeSocket, @MessageBody() body: ChatSendDto) {
    if (!this.rateLimiter.consume(client.id, "chat:send")) {
      this.emitSocketError(client, SOCKET_ERROR_CODE.RATE_LIMIT, SOCKET_ERROR_DETAIL_MESSAGE.TOO_MANY_MESSAGES);
      return { success: false };
    }
    const roomCode = client.data.roomId;
    const userId = this.requireUserId(client);
    const nickname = this.requireNickname(client);
    if (!roomCode) return { success: false };
    const content = body.content.trim();
    if (!content) return { success: false };
    const msg = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      playerId: userId,
      nickname,
      content: content.slice(0, CHAT_MESSAGE_MAX_LENGTH),
      type: "text" as const,
      timestamp: new Date().toISOString(),
    };
    this.server.to(roomCode).emit("chat:message", msg);
    return { success: true };
  }

  @SubscribeMessage("webrtc:join-room")
  @UsePipes(SOCKET_VALIDATION_PIPE)
  handleWebrtcJoin(@ConnectedSocket() client: RealtimeSocket, @MessageBody() data: WebrtcJoinRoomDto) {
    const userId = this.requireUserId(client);
    this.clearMediaDisconnectTimer(client.id);
    const room = this.getRoomForMediaAction(client, data.roomCode);
    if (!room) {
      return this.failureResult(
        SOCKET_ERROR_CODE.NOT_IN_ROOM,
        SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.NOT_IN_ROOM] as string,
      );
    }

    const result = this.mediaPresence.joinRoom({
      room,
      userId,
      socketId: client.id,
      audioEnabled: data.audioEnabled,
      videoEnabled: data.videoEnabled,
      activeSocketIds: this.getActiveSocketIdsForUser(userId),
    });

    if (!result.ok) {
      return this.failureResult(result.code, result.message);
    }

    client.data.roomId = room.roomCode;
    if (result.joined) {
      client.to(room.roomCode).emit("webrtc:peer-joined", {
        participant: result.participant,
      });
    }

    return this.successResult({
      selfPeerId: result.selfPeerId,
      participants: result.participants,
      iceServers: this.mediaConfig.getIceServers(),
    });
  }

  @SubscribeMessage("webrtc:leave-room")
  handleWebrtcLeave(@ConnectedSocket() client: RealtimeSocket) {
    this.clearMediaDisconnectTimer(client.id);
    const roomCode = this.mediaPresence.getRoomCodeForSocket(client.id) ?? this.getResolvedRoomCode(client) ?? null;
    const participant = this.mediaPresence.leaveBySocket(client.id);
    if (!participant) {
      return this.successResult();
    }

    if (roomCode) {
      this.server.to(roomCode).emit("webrtc:peer-left", { peerId: participant.peerId });
    }
    return this.successResult();
  }

  @SubscribeMessage("webrtc:update-media-state")
  @UsePipes(SOCKET_VALIDATION_PIPE)
  handleWebrtcUpdateMediaState(
    @ConnectedSocket() client: RealtimeSocket,
    @MessageBody() data: WebrtcMediaStateDto,
  ) {
    const room = this.getRoomForMediaAction(client);
    const userId = this.requireUserId(client);
    if (!room) {
      return this.failureResult(
        SOCKET_ERROR_CODE.NOT_IN_ROOM,
        SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.NOT_IN_ROOM] as string,
      );
    }

    const participant = this.mediaPresence.updateMediaState(room, userId, data);
    if (!participant) {
      return this.failureResult(
        SOCKET_ERROR_CODE.MEDIA_NOT_JOINED,
        SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.MEDIA_NOT_JOINED] as string,
      );
    }

    this.emitMediaState(room.roomCode, participant);
    return this.successResult();
  }

  @SubscribeMessage("webrtc:offer")
  handleOffer(
    @ConnectedSocket() client: RealtimeSocket,
    @MessageBody() data: MediaSignalOffer,
  ) {
    const room = this.getRoomForMediaAction(client);
    const userId = this.requireUserId(client);
    if (!room) {
      return this.failureResult(
        SOCKET_ERROR_CODE.NOT_IN_ROOM,
        SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.NOT_IN_ROOM] as string,
      );
    }

    if (!this.mediaPresence.getParticipant(room.roomCode, userId)) {
      return this.failureResult(
        SOCKET_ERROR_CODE.MEDIA_NOT_JOINED,
        SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.MEDIA_NOT_JOINED] as string,
      );
    }

    const didEmit = this.emitToMediaPeer(room.roomCode, data.targetPeerId, "webrtc:offer", {
      fromPeerId: userId,
      offer: data.offer,
    });

    if (!didEmit) {
      return this.failureResult(
        SOCKET_ERROR_CODE.MEDIA_PEER_NOT_FOUND,
        SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.MEDIA_PEER_NOT_FOUND] as string,
      );
    }

    return this.successResult();
  }

  @SubscribeMessage("webrtc:answer")
  handleAnswer(
    @ConnectedSocket() client: RealtimeSocket,
    @MessageBody() data: MediaSignalAnswer,
  ) {
    const room = this.getRoomForMediaAction(client);
    const userId = this.requireUserId(client);
    if (!room) {
      return this.failureResult(
        SOCKET_ERROR_CODE.NOT_IN_ROOM,
        SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.NOT_IN_ROOM] as string,
      );
    }

    if (!this.mediaPresence.getParticipant(room.roomCode, userId)) {
      return this.failureResult(
        SOCKET_ERROR_CODE.MEDIA_NOT_JOINED,
        SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.MEDIA_NOT_JOINED] as string,
      );
    }

    const didEmit = this.emitToMediaPeer(room.roomCode, data.targetPeerId, "webrtc:answer", {
      fromPeerId: userId,
      answer: data.answer,
    });

    if (!didEmit) {
      return this.failureResult(
        SOCKET_ERROR_CODE.MEDIA_PEER_NOT_FOUND,
        SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.MEDIA_PEER_NOT_FOUND] as string,
      );
    }

    return this.successResult();
  }

  @SubscribeMessage("webrtc:ice-candidate")
  handleIce(
    @ConnectedSocket() client: RealtimeSocket,
    @MessageBody() data: MediaSignalIceCandidate,
  ) {
    const room = this.getRoomForMediaAction(client);
    const userId = this.requireUserId(client);
    if (!room) {
      return this.failureResult(
        SOCKET_ERROR_CODE.NOT_IN_ROOM,
        SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.NOT_IN_ROOM] as string,
      );
    }

    if (!this.mediaPresence.getParticipant(room.roomCode, userId)) {
      return this.failureResult(
        SOCKET_ERROR_CODE.MEDIA_NOT_JOINED,
        SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.MEDIA_NOT_JOINED] as string,
      );
    }

    const didEmit = this.emitToMediaPeer(room.roomCode, data.targetPeerId, "webrtc:ice-candidate", {
      fromPeerId: userId,
      candidate: data.candidate,
    });

    if (!didEmit) {
      return this.failureResult(
        SOCKET_ERROR_CODE.MEDIA_PEER_NOT_FOUND,
        SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.MEDIA_PEER_NOT_FOUND] as string,
      );
    }

    return this.successResult();
  }

  private syncRoomPlayers(room: import("../room/room.service").ServerRoom) {
    this.roomService.syncRoomPlayersFromGame(room);
  }
}
