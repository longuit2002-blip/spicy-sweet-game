import { Module } from "@nestjs/common";
import { GameLoopService } from "./game-loop.service";
import { GameBotDriverService } from "./game-bot-driver.service";
import { GameBroadcastService } from "./game-broadcast.service";
import { RoomModule } from "../room/room.module";

@Module({
  imports: [RoomModule],
  providers: [GameLoopService, GameBotDriverService, GameBroadcastService],
  exports: [GameLoopService, GameBotDriverService, GameBroadcastService],
})
export class GameLoopModule {}
