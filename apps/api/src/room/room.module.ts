import { Global, Module } from "@nestjs/common";
import { RoomService } from "./room.service";

@Global()
@Module({
  providers: [RoomService],
  exports: [RoomService],
})
export class RoomModule {}
