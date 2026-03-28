import { Module } from "@nestjs/common";
import { GameLoopService } from "./game-loop.service";
import { GameBroadcastService } from "./game-broadcast.service";
import { RoomModule } from "../room/room.module";

@Module({
  imports: [RoomModule],
  providers: [GameLoopService, GameBroadcastService],
  exports: [GameLoopService, GameBroadcastService],
})
export class GameLoopModule {}
