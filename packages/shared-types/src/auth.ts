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
  code: string;
  message: string;
  details?: Record<string, unknown>;
}
