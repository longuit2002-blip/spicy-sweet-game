import { Module } from "@nestjs/common";
import { RealtimeGateway } from "./realtime.gateway";
import { SocketRateLimiterService } from "./socket-rate-limiter.service";
import { RoomModule } from "../room/room.module";
import { GameLoopModule } from "../game/game-loop.module";
import { RealtimeChatService } from "./realtime-chat.service";
import { RealtimeGameplayService } from "./realtime-gameplay.service";
import { RealtimeRoomService } from "./realtime-room.service";
import { RealtimeSessionService } from "./realtime-session.service";

@Module({
  imports: [RoomModule, GameLoopModule],
  providers: [
    RealtimeGateway,
    SocketRateLimiterService,
    RealtimeSessionService,
    RealtimeRoomService,
    RealtimeGameplayService,
    RealtimeChatService,
  ],
  exports: [RealtimeSessionService],
})
export class RealtimeModule {}
