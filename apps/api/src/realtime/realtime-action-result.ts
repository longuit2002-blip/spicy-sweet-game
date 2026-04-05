import type { SocketActionResult, SocketErrorCode } from "@sweet-spicy/shared-types";
import type { RealtimeSocket } from "./realtime-socket.types";

export function emitSocketError(
  client: RealtimeSocket,
  code: SocketErrorCode,
  message: string,
): void {
  client.emit("error", { code, message });
}

export function successResult<T extends object = Record<never, never>>(
  extra?: T,
): { success: true } & T {
  return { success: true, ...(extra ?? {}) } as { success: true } & T;
}

export function failureResult(
  code: SocketErrorCode,
  message: string,
): SocketActionResult {
  return { success: false, code, message };
}
