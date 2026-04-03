import type { SocketErrorCode } from "./socket-error-codes.js";

export interface AuthUser {
  id: string;
  nickname: string;
  avatarUrl?: string;
}

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

export interface SocketError {
  code: SocketErrorCode;
  message: string;
  details?: Record<string, unknown>;
}
