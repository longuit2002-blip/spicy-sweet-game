import { ROOM_CODE_MAX_LENGTH, ROOM_CODE_MIN_LENGTH } from "@sweet-spicy/shared-types";

/** Validates join payload (string or `{ roomCode | code }`) and returns normalized room code. */
export function parseRoomJoinCode(payload: unknown): string | null {
  if (typeof payload === "string") {
    const c = payload.trim().toUpperCase();
    if (c.length < ROOM_CODE_MIN_LENGTH || c.length > ROOM_CODE_MAX_LENGTH) return null;
    return c;
  }
  if (payload !== null && typeof payload === "object") {
    const o = payload as Record<string, unknown>;
    const raw = o.roomCode ?? o.code;
    if (typeof raw !== "string") return null;
    const c = raw.trim().toUpperCase();
    if (c.length < ROOM_CODE_MIN_LENGTH || c.length > ROOM_CODE_MAX_LENGTH) return null;
    return c;
  }
  return null;
}
