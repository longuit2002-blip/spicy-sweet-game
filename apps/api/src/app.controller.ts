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
  async health() {
    const activeRooms = await this.roomRepository.getRoomCount();
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      realtime: {
        activeRooms,
        ...this.realtimeSession.getMetricsSnapshot(),
        ...this.roomObservability.snapshot(),
      },
    };
  }
}
