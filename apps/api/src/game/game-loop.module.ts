import { Module } from "@nestjs/common";
import { GameLoopService } from "./game-loop.service";
import { RoomModule } from "../room/room.module";

@Module({
  imports: [RoomModule],
  providers: [GameLoopService],
  exports: [GameLoopService],
})
export class GameLoopModule {}
