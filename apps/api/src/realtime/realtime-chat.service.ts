import { Injectable } from "@nestjs/common";
import {
  CHAT_MESSAGE_MAX_LENGTH,
  SOCKET_ERROR_CODE,
  SOCKET_ERROR_DETAIL_MESSAGE,
  SOCKET_ERROR_MESSAGE,
  type SocketActionResult,
} from "@sweet-spicy/shared-types";
import { RealtimeSessionService } from "./realtime-session.service";
import type { RealtimeSocket } from "./realtime-socket.types";
import { SocketRateLimiterService } from "./socket-rate-limiter.service";
import { emitSocketError, successResult } from "./realtime-action-result";

@Injectable()
export class RealtimeChatService {
  constructor(
    private readonly session: RealtimeSessionService,
    private readonly rateLimiter: SocketRateLimiterService,
  ) {}

  handleChat(client: RealtimeSocket, content: string): SocketActionResult {
    if (!this.rateLimiter.consume(client.id, "chat:send")) {
      emitSocketError(client, SOCKET_ERROR_CODE.RATE_LIMIT, SOCKET_ERROR_DETAIL_MESSAGE.TOO_MANY_MESSAGES);
      return {
        success: false,
        code: SOCKET_ERROR_CODE.RATE_LIMIT,
        message: SOCKET_ERROR_DETAIL_MESSAGE.TOO_MANY_MESSAGES,
      };
    }

    const roomCode = client.data.roomId;
    if (!roomCode) {
      return {
        success: false,
        code: SOCKET_ERROR_CODE.NOT_IN_ROOM,
        message: SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.NOT_IN_ROOM] as string,
      };
    }

    const userId = this.session.requireUserId(client);
    const nickname = this.session.requireNickname(client);
    const trimmedContent = content.trim();
    if (!trimmedContent) {
      return successResult();
    }

    client.nsp.to(roomCode).emit("chat:message", {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      playerId: userId,
      nickname,
      content: trimmedContent.slice(0, CHAT_MESSAGE_MAX_LENGTH),
      type: "text",
      timestamp: new Date().toISOString(),
    });

    return successResult();
  }
}
