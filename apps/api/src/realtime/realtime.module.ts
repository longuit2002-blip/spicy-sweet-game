import { Module } from "@nestjs/common";
import { RealtimeGateway } from "./realtime.gateway";
import { MediaConfigService } from "./media-config.service";
import { MediaPresenceService } from "./media-presence.service";
import { SocketRateLimiterService } from "./socket-rate-limiter.service";
import { RoomModule } from "../room/room.module";
import { GameLoopModule } from "../game/game-loop.module";
import { RealtimeChatService } from "./realtime-chat.service";
import { RealtimeGameplayService } from "./realtime-gameplay.service";
import { RealtimeMediaService } from "./realtime-media.service";
import { RealtimeRoomService } from "./realtime-room.service";
import { RealtimeSessionService } from "./realtime-session.service";

@Module({
  imports: [RoomModule, GameLoopModule],
  providers: [
    RealtimeGateway,
    SocketRateLimiterService,
    MediaConfigService,
    MediaPresenceService,
    RealtimeSessionService,
    RealtimeRoomService,
    RealtimeGameplayService,
    RealtimeChatService,
    RealtimeMediaService,
  ],
  exports: [RealtimeSessionService],
})
export class RealtimeModule {}
