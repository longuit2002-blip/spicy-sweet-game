import { Module } from "@nestjs/common";
import { RealtimeGateway } from "./realtime.gateway";
import { RoomModule } from "../room/room.module";
import { GameLoopModule } from "../game/game-loop.module";

@Module({
  imports: [RoomModule, GameLoopModule],
  providers: [RealtimeGateway],
})
export class RealtimeModule {}
