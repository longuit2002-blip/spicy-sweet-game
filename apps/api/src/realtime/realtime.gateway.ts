import { UsePipes, ValidationPipe } from "@nestjs/common";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import type { RealtimeServer, RealtimeSocket } from "./realtime-socket.types";
import { GameBotDriverService } from "../game/game-bot-driver.service";
import { GameLoopService } from "../game/game-loop.service";
import { ChatSendDto } from "./dto/chat-send.dto";
import { ChallengeDto } from "./dto/challenge.dto";
import { PlayCardDto } from "./dto/play-card.dto";
import { RoomCreateDto } from "./dto/room-create.dto";
import { RealtimeChatService } from "./realtime-chat.service";
import { RealtimeGameplayService } from "./realtime-gameplay.service";
import { RealtimeRoomService } from "./realtime-room.service";
import { RealtimeSessionService } from "./realtime-session.service";
import { getClientCorsOrigin } from "../config/client-origins";

const SOCKET_VALIDATION_PIPE = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: false,
});

@WebSocketGateway({
  cors: { origin: getClientCorsOrigin(), credentials: true },
  transports: ["websocket", "polling"],
})
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: RealtimeServer;

  constructor(
    private readonly session: RealtimeSessionService,
    private readonly roomRealtime: RealtimeRoomService,
    private readonly gameplayRealtime: RealtimeGameplayService,
    private readonly chatRealtime: RealtimeChatService,
    private readonly gameLoop: GameLoopService,
    private readonly gameBotDriver: GameBotDriverService,
  ) {}

  afterInit(server: RealtimeServer): void {
    this.session.attachServer(server);
    this.session.bindAuthMiddleware();
    this.gameLoop.attachServer(server);
    this.gameBotDriver.attachServer(server);
  }

  handleConnection(client: RealtimeSocket): void {
    this.session.handleConnection(client);
  }

  handleDisconnect(client: RealtimeSocket): void {
    this.session.handleDisconnect(client);
  }

  @SubscribeMessage("room:create")
  @UsePipes(SOCKET_VALIDATION_PIPE)
  async handleCreate(@ConnectedSocket() client: RealtimeSocket, @MessageBody() data: RoomCreateDto) {
    return this.roomRealtime.handleCreate(client, data.maxPlayers);
  }

  @SubscribeMessage("room:join")
  async handleJoin(@ConnectedSocket() client: RealtimeSocket, @MessageBody() payload: unknown) {
    return this.roomRealtime.handleJoin(client, payload);
  }

  @SubscribeMessage("room:leave")
  async handleLeave(@ConnectedSocket() client: RealtimeSocket) {
    return this.roomRealtime.handleLeave(client);
  }

  @SubscribeMessage("room:ready")
  async handleReady(@ConnectedSocket() client: RealtimeSocket, @MessageBody() ready: boolean) {
    return this.roomRealtime.handleReady(client, ready);
  }

  @SubscribeMessage("room:add-bot")
  async handleAddBot(@ConnectedSocket() client: RealtimeSocket) {
    return this.roomRealtime.handleAddBot(client);
  }

  @SubscribeMessage("room:start")
  async handleStart(@ConnectedSocket() client: RealtimeSocket) {
    return this.roomRealtime.handleStart(client);
  }

  @SubscribeMessage("game:play-card")
  @UsePipes(SOCKET_VALIDATION_PIPE)
  async handlePlayCard(@ConnectedSocket() client: RealtimeSocket, @MessageBody() data: PlayCardDto) {
    return this.gameplayRealtime.handlePlayCard(client, data.cardId, data.declaration);
  }

  @SubscribeMessage("game:draw-pass")
  async handleDrawPass(@ConnectedSocket() client: RealtimeSocket) {
    return this.gameplayRealtime.handleDrawPass(client);
  }

  @SubscribeMessage("game:claim-challenge")
  async handleClaimChallenge(@ConnectedSocket() client: RealtimeSocket) {
    return this.gameplayRealtime.handleClaimChallenge(client);
  }

  @SubscribeMessage("game:challenge")
  @UsePipes(SOCKET_VALIDATION_PIPE)
  async handleChallenge(@ConnectedSocket() client: RealtimeSocket, @MessageBody() data: ChallengeDto) {
    return this.gameplayRealtime.handleChallenge(client, data.challengeType);
  }

  @SubscribeMessage("game:challenge-pass")
  async handleChallengePass(@ConnectedSocket() client: RealtimeSocket) {
    return this.gameplayRealtime.handleChallengePass(client);
  }

  @SubscribeMessage("game:accept")
  async handleAccept(@ConnectedSocket() client: RealtimeSocket) {
    return this.gameplayRealtime.handleAccept(client);
  }

  @SubscribeMessage("chat:send")
  @UsePipes(SOCKET_VALIDATION_PIPE)
  handleChat(@ConnectedSocket() client: RealtimeSocket, @MessageBody() body: ChatSendDto) {
    return this.chatRealtime.handleChat(client, body.content);
  }
}
