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
import type { Server, Socket } from "socket.io";
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
import { parseRoomJoinCode } from "./parse-room-join";

const SOCKET_VALIDATION_PIPE = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: false,
});

const DISCONNECT_GRACE_PERIOD_MS = 30_000;

@WebSocketGateway({
  cors: { origin: process.env.CLIENT_URL ?? "*", credentials: true },
  transports: ["websocket", "polling"],
})
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly activeSocketIdsByUser = new Map<string, Set<string>>();
  private readonly disconnectTimersByUser = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    private readonly jwt: JwtService,
    private readonly roomService: RoomService,
    private readonly gameLoop: GameLoopService,
    private readonly gameBotDriver: GameBotDriverService,
    private readonly broadcast: GameBroadcastService,
    private readonly rateLimiter: SocketRateLimiterService,
  ) {}

  private emitSocketError(client: Socket, code: SocketErrorCode, message: string): void {
    client.emit("error", { code, message });
  }

  private successResult<T extends object = Record<never, never>>(extra?: T): { success: true } & T {
    return { success: true, ...(extra ?? {}) } as { success: true } & T;
  }

  private failureResult(code: SocketErrorCode, message: string): SocketActionResult {
    return { success: false, code, message };
  }

  private emitRateLimit(client: Socket): void {
    this.emitSocketError(
      client,
      SOCKET_ERROR_CODE.RATE_LIMIT,
      SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.RATE_LIMIT] as string,
    );
  }

  afterInit(server: Server) {
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

  handleConnection(client: Socket): void {
    const userId = client.data.userId as string | undefined;
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

  handleDisconnect(client: Socket): void {
    const userId = client.data.userId as string | undefined;
    if (!userId) {
      return;
    }
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
      clearTimeout(this.disconnectTimersByUser.get(userId)!);
    }
    const timer = setTimeout(() => {
      this.disconnectTimersByUser.delete(userId);
      this.leaveUserFromCurrentRoom(userId);
    }, DISCONNECT_GRACE_PERIOD_MS);
    this.disconnectTimersByUser.set(userId, timer);
  }

  private getActiveSocketsForUser(userId: string): Socket[] {
    const activeSocketIds = this.activeSocketIdsByUser.get(userId);
    if (!activeSocketIds) {
      return [];
    }
    return Array.from(activeSocketIds)
      .map((socketId) => this.server.sockets.sockets.get(socketId))
      .filter((socket): socket is Socket => socket !== undefined);
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

  private leaveUserFromCurrentRoom(userId: string): void {
    const leaveResult = this.roomService.leaveRoom(userId);
    if (!leaveResult.roomCode) {
      return;
    }
    this.clearRoomMembershipFromActiveSockets(userId, leaveResult.roomCode);
    this.broadcastLeaveResult(userId, leaveResult);
  }

  @SubscribeMessage("room:create")
  @UsePipes(SOCKET_VALIDATION_PIPE)
  handleCreate(@ConnectedSocket() client: Socket, @MessageBody() data: RoomCreateDto) {
    if (!this.rateLimiter.consume(client.id, "room:create")) {
      this.emitRateLimit(client);
      return this.failureResult(
        SOCKET_ERROR_CODE.RATE_LIMIT,
        SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.RATE_LIMIT] as string,
      );
    }
    const userId = client.data.userId as string;
    const nickname = client.data.nickname as string;
    const { room, previousLeave } = this.roomService.createRoom(
      userId,
      nickname,
      data.maxPlayers ?? DEFAULT_ROOM_MAX_PLAYERS,
    );
    if (previousLeave?.roomCode) {
      this.clearRoomMembershipFromActiveSockets(userId, previousLeave.roomCode);
      this.broadcastLeaveResult(userId, previousLeave);
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
  handleJoin(@ConnectedSocket() client: Socket, @MessageBody() payload: unknown) {
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
    const userId = client.data.userId as string;
    const nickname = client.data.nickname as string;
    const result = this.roomService.joinRoom(code, userId, nickname);
    if (!result.ok) {
      return this.failureResult(result.code, result.message);
    }
    if (result.previousLeave?.roomCode) {
      this.clearRoomMembershipFromActiveSockets(userId, result.previousLeave.roomCode);
      this.broadcastLeaveResult(userId, result.previousLeave);
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
  handleLeave(@ConnectedSocket() client: Socket) {
    if (!this.rateLimiter.consume(client.id, "room:leave")) {
      this.emitRateLimit(client);
      return this.failureResult(
        SOCKET_ERROR_CODE.RATE_LIMIT,
        SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.RATE_LIMIT] as string,
      );
    }
    const userId = client.data.userId as string;
    const room = this.roomService.getRoomForUser(userId);
    if (!room) {
      return this.failureResult(
        SOCKET_ERROR_CODE.NOT_IN_ROOM,
        SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.NOT_IN_ROOM] as string,
      );
    }
    this.leaveUserFromCurrentRoom(userId);
    return this.successResult();
  }

  @SubscribeMessage("room:ready")
  handleReady(@ConnectedSocket() client: Socket, @MessageBody() ready: unknown) {
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
    const userId = client.data.userId as string;
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
  handleAddBot(@ConnectedSocket() client: Socket) {
    if (!this.rateLimiter.consume(client.id, "room:add-bot")) {
      this.emitRateLimit(client);
      return this.failureResult(
        SOCKET_ERROR_CODE.RATE_LIMIT,
        SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.RATE_LIMIT] as string,
      );
    }
    const userId = client.data.userId as string;
    const socketRoomCode = client.data.roomId as string | undefined;
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
  handleStart(@ConnectedSocket() client: Socket) {
    if (!this.rateLimiter.consume(client.id, "room:start")) {
      this.emitRateLimit(client);
      return this.failureResult(
        SOCKET_ERROR_CODE.RATE_LIMIT,
        SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.RATE_LIMIT] as string,
      );
    }
    const userId = client.data.userId as string;
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
  handlePlayCard(@ConnectedSocket() client: Socket, @MessageBody() data: PlayCardDto) {
    if (!this.rateLimiter.consume(client.id, "game:play-card")) {
      this.emitRateLimit(client);
      return this.failureResult(
        SOCKET_ERROR_CODE.RATE_LIMIT,
        SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.RATE_LIMIT] as string,
      );
    }
    const roomCode = client.data.roomId as string | undefined;
    const userId = client.data.userId as string;
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
  handleDrawPass(@ConnectedSocket() client: Socket) {
    if (!this.rateLimiter.consume(client.id, "game:draw-pass")) {
      this.emitRateLimit(client);
      return this.failureResult(
        SOCKET_ERROR_CODE.RATE_LIMIT,
        SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.RATE_LIMIT] as string,
      );
    }
    const roomCode = client.data.roomId as string | undefined;
    const userId = client.data.userId as string;
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
  handleClaimChallenge(@ConnectedSocket() client: Socket) {
    if (!this.rateLimiter.consume(client.id, "game:claim-challenge")) {
      this.emitRateLimit(client);
      return this.failureResult(
        SOCKET_ERROR_CODE.RATE_LIMIT,
        SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.RATE_LIMIT] as string,
      );
    }
    const roomCode = client.data.roomId as string | undefined;
    const userId = client.data.userId as string;
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
  handleChallenge(@ConnectedSocket() client: Socket, @MessageBody() data: ChallengeDto) {
    if (!this.rateLimiter.consume(client.id, "game:challenge")) {
      this.emitRateLimit(client);
      return this.failureResult(
        SOCKET_ERROR_CODE.RATE_LIMIT,
        SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.RATE_LIMIT] as string,
      );
    }
    const roomCode = client.data.roomId as string | undefined;
    const userId = client.data.userId as string;
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
  handleChallengePass(@ConnectedSocket() client: Socket) {
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
  handleAccept(@ConnectedSocket() client: Socket) {
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
  private tryRecordChallengePass(client: Socket): SocketActionResult {
    const roomCode = client.data.roomId as string | undefined;
    const userId = client.data.userId as string;
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
  handleChat(@ConnectedSocket() client: Socket, @MessageBody() body: ChatSendDto) {
    if (!this.rateLimiter.consume(client.id, "chat:send")) {
      this.emitSocketError(client, SOCKET_ERROR_CODE.RATE_LIMIT, SOCKET_ERROR_DETAIL_MESSAGE.TOO_MANY_MESSAGES);
      return { success: false };
    }
    const roomCode = client.data.roomId as string | undefined;
    const userId = client.data.userId as string;
    const nickname = client.data.nickname as string;
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
  handleWebrtcJoin(@ConnectedSocket() client: Socket, @MessageBody() _roomCode?: string) {
    const roomCode = (client.data.roomId as string) ?? _roomCode;
    const userId = client.data.userId as string;
    if (!roomCode) return { success: false };
    client.to(roomCode).emit("webrtc:peer-joined", { peerId: userId });
    return { success: true };
  }

  @SubscribeMessage("webrtc:leave-room")
  handleWebrtcLeave(@ConnectedSocket() client: Socket) {
    const roomCode = client.data.roomId as string | undefined;
    const userId = client.data.userId as string;
    if (!roomCode) return { success: false };
    client.to(roomCode).emit("webrtc:peer-left", { peerId: userId });
    return { success: true };
  }

  @SubscribeMessage("webrtc:offer")
  handleOffer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { peerId: string; offer: RTCSessionDescriptionInit },
  ) {
    const roomCode = client.data.roomId as string | undefined;
    const userId = client.data.userId as string;
    if (!roomCode) return { success: false };
    client.to(roomCode).emit("webrtc:offer", { peerId: userId, offer: data.offer });
    return { success: true };
  }

  @SubscribeMessage("webrtc:answer")
  handleAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { peerId: string; answer: RTCSessionDescriptionInit },
  ) {
    const roomCode = client.data.roomId as string | undefined;
    const userId = client.data.userId as string;
    if (!roomCode) return { success: false };
    client.to(roomCode).emit("webrtc:answer", { peerId: userId, answer: data.answer });
    return { success: true };
  }

  @SubscribeMessage("webrtc:ice-candidate")
  handleIce(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { peerId: string; candidate: RTCIceCandidateInit },
  ) {
    const roomCode = client.data.roomId as string | undefined;
    const userId = client.data.userId as string;
    if (!roomCode) return { success: false };
    client.to(roomCode).emit("webrtc:ice-candidate", { peerId: userId, candidate: data.candidate });
    return { success: true };
  }

  private syncRoomPlayers(room: import("../room/room.service").ServerRoom) {
    this.roomService.syncRoomPlayersFromGame(room);
  }
}
