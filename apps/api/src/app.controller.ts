import { Controller, Get } from "@nestjs/common";
import { RoomObservabilityService } from "./room/room-observability.service";
import { RoomRepository } from "./room/room.repository";
import { RealtimeSessionService } from "./realtime/realtime-session.service";

@Controller()
export class AppController {
  constructor(
    private readonly roomRepository: RoomRepository,
    private readonly roomObservability: RoomObservabilityService,
    private readonly realtimeSession: RealtimeSessionService,
  ) {}

  @Get("health")
  health() {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      realtime: {
        activeRooms: this.roomRepository.getRoomCount(),
        ...this.realtimeSession.getMetricsSnapshot(),
        ...this.roomObservability.snapshot(),
      },
    };
  }
}
