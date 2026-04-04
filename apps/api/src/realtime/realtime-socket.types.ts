import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@sweet-spicy/shared-types";
import type { Server, Socket } from "socket.io";

export interface RealtimeSocketData {
  userId?: string;
  nickname?: string;
  roomId?: string;
}

type RealtimeInterServerEvents = Record<never, never>;

export type RealtimeSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  RealtimeInterServerEvents,
  RealtimeSocketData
>;

export type RealtimeServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  RealtimeInterServerEvents,
  RealtimeSocketData
>;
