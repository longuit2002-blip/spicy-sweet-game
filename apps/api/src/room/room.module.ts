import { Global, Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { RoomObservabilityService } from "./room-observability.service";
import { RoomRepository } from "./room.repository";
import { RoomSessionPersistenceService } from "./room-session-persistence.service";
import { RoomService } from "./room.service";

@Global()
@Module({
  imports: [PrismaModule],
  providers: [
    RoomRepository,
    RoomObservabilityService,
    RoomSessionPersistenceService,
    RoomService,
  ],
  exports: [
    RoomRepository,
    RoomObservabilityService,
    RoomSessionPersistenceService,
    RoomService,
  ],
})
export class RoomModule {}
