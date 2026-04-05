import { Injectable } from "@nestjs/common";

interface RoomObservabilitySnapshot {
  reconnectSuccessCount: number;
  disconnectHandoffCount: number;
  invalidMoveCount: number;
  completedMatchCount: number;
  averageMatchDurationSeconds: number;
}

@Injectable()
export class RoomObservabilityService {
  private reconnectSuccessCount = 0;
  private disconnectHandoffCount = 0;
  private invalidMoveCount = 0;
  private completedMatchCount = 0;
  private totalMatchDurationSeconds = 0;

  recordReconnectSuccess(): void {
    this.reconnectSuccessCount += 1;
  }

  recordDisconnectHandoff(): void {
    this.disconnectHandoffCount += 1;
  }

  recordInvalidMove(): void {
    this.invalidMoveCount += 1;
  }

  recordMatchCompleted(durationSeconds: number): void {
    this.completedMatchCount += 1;
    this.totalMatchDurationSeconds += Math.max(0, durationSeconds);
  }

  snapshot(): RoomObservabilitySnapshot {
    return {
      reconnectSuccessCount: this.reconnectSuccessCount,
      disconnectHandoffCount: this.disconnectHandoffCount,
      invalidMoveCount: this.invalidMoveCount,
      completedMatchCount: this.completedMatchCount,
      averageMatchDurationSeconds:
        this.completedMatchCount === 0
          ? 0
          : Math.round(this.totalMatchDurationSeconds / this.completedMatchCount),
    };
  }
}
