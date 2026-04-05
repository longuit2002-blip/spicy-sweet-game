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
import type {
  MediaSignalAnswer,
  MediaSignalIceCandidate,
  MediaSignalOffer,
} from "@sweet-spicy/shared-types";
import type { RealtimeServer, RealtimeSocket } from "./realtime-socket.types";
import { GameBotDriverService } from "../game/game-bot-driver.service";
import { GameLoopService } from "../game/game-loop.service";
import { ChatSendDto } from "./dto/chat-send.dto";
import { ChallengeDto } from "./dto/challenge.dto";
import { PlayCardDto } from "./dto/play-card.dto";
import { RoomCreateDto } from "./dto/room-create.dto";
import { WebrtcJoinRoomDto } from "./dto/webrtc-join-room.dto";
import { WebrtcMediaStateDto } from "./dto/webrtc-media-state.dto";
import { RealtimeChatService } from "./realtime-chat.service";
import { RealtimeGameplayService } from "./realtime-gameplay.service";
import { RealtimeMediaService } from "./realtime-media.service";
import { RealtimeRoomService } from "./realtime-room.service";
import { RealtimeSessionService } from "./realtime-session.service";

const SOCKET_VALIDATION_PIPE = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: false,
});

@WebSocketGateway({
  cors: { origin: process.env.CLIENT_URL ?? "http://localhost:3000", credentials: true },
  transports: ["websocket", "polling"],
})
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: RealtimeServer;

  constructor(
    private readonly session: RealtimeSessionService,
    private readonly roomRealtime: RealtimeRoomService,
    private readonly gameplayRealtime: RealtimeGameplayService,
    private readonly chatRealtime: RealtimeChatService,
    private readonly mediaRealtime: RealtimeMediaService,
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
  handleCreate(@ConnectedSocket() client: RealtimeSocket, @MessageBody() data: RoomCreateDto) {
    return this.roomRealtime.handleCreate(client, data.maxPlayers);
  }

  @SubscribeMessage("room:join")
  handleJoin(@ConnectedSocket() client: RealtimeSocket, @MessageBody() payload: unknown) {
    return this.roomRealtime.handleJoin(client, payload);
  }

  @SubscribeMessage("room:leave")
  handleLeave(@ConnectedSocket() client: RealtimeSocket) {
    return this.roomRealtime.handleLeave(client);
  }

  @SubscribeMessage("room:ready")
  handleReady(@ConnectedSocket() client: RealtimeSocket, @MessageBody() ready: boolean) {
    return this.roomRealtime.handleReady(client, ready);
  }

  @SubscribeMessage("room:add-bot")
  handleAddBot(@ConnectedSocket() client: RealtimeSocket) {
    return this.roomRealtime.handleAddBot(client);
  }

  @SubscribeMessage("room:start")
  handleStart(@ConnectedSocket() client: RealtimeSocket) {
    return this.roomRealtime.handleStart(client);
  }

  @SubscribeMessage("game:play-card")
  @UsePipes(SOCKET_VALIDATION_PIPE)
  handlePlayCard(@ConnectedSocket() client: RealtimeSocket, @MessageBody() data: PlayCardDto) {
    return this.gameplayRealtime.handlePlayCard(client, data.cardId, data.declaration);
  }

  @SubscribeMessage("game:draw-pass")
  handleDrawPass(@ConnectedSocket() client: RealtimeSocket) {
    return this.gameplayRealtime.handleDrawPass(client);
  }

  @SubscribeMessage("game:claim-challenge")
  handleClaimChallenge(@ConnectedSocket() client: RealtimeSocket) {
    return this.gameplayRealtime.handleClaimChallenge(client);
  }

  @SubscribeMessage("game:challenge")
  @UsePipes(SOCKET_VALIDATION_PIPE)
  handleChallenge(@ConnectedSocket() client: RealtimeSocket, @MessageBody() data: ChallengeDto) {
    return this.gameplayRealtime.handleChallenge(client, data.challengeType);
  }

  @SubscribeMessage("game:challenge-pass")
  handleChallengePass(@ConnectedSocket() client: RealtimeSocket) {
    return this.gameplayRealtime.handleChallengePass(client);
  }

  @SubscribeMessage("game:accept")
  handleAccept(@ConnectedSocket() client: RealtimeSocket) {
    return this.gameplayRealtime.handleAccept(client);
  }

  @SubscribeMessage("chat:send")
  @UsePipes(SOCKET_VALIDATION_PIPE)
  handleChat(@ConnectedSocket() client: RealtimeSocket, @MessageBody() body: ChatSendDto) {
    return this.chatRealtime.handleChat(client, body.content);
  }

  @SubscribeMessage("webrtc:join-room")
  @UsePipes(SOCKET_VALIDATION_PIPE)
  handleWebrtcJoin(@ConnectedSocket() client: RealtimeSocket, @MessageBody() data: WebrtcJoinRoomDto) {
    return this.mediaRealtime.handleJoin(client, data);
  }

  @SubscribeMessage("webrtc:leave-room")
  handleWebrtcLeave(@ConnectedSocket() client: RealtimeSocket) {
    return this.mediaRealtime.handleLeave(client);
  }

  @SubscribeMessage("webrtc:update-media-state")
  @UsePipes(SOCKET_VALIDATION_PIPE)
  handleWebrtcUpdateMediaState(
    @ConnectedSocket() client: RealtimeSocket,
    @MessageBody() data: WebrtcMediaStateDto,
  ) {
    return this.mediaRealtime.handleUpdateMediaState(client, data);
  }

  @SubscribeMessage("webrtc:offer")
  handleOffer(@ConnectedSocket() client: RealtimeSocket, @MessageBody() data: MediaSignalOffer) {
    return this.mediaRealtime.handleOffer(client, data);
  }

  @SubscribeMessage("webrtc:answer")
  handleAnswer(@ConnectedSocket() client: RealtimeSocket, @MessageBody() data: MediaSignalAnswer) {
    return this.mediaRealtime.handleAnswer(client, data);
  }

  @SubscribeMessage("webrtc:ice-candidate")
  handleIce(@ConnectedSocket() client: RealtimeSocket, @MessageBody() data: MediaSignalIceCandidate) {
    return this.mediaRealtime.handleIceCandidate(client, data);
  }
}
