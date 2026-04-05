export interface MediaTokenRequest {
  roomCode: string;
}

export interface MediaTokenResponse {
  livekitUrl: string;
  token: string;
  roomCode: string;
  participantIdentity: string;
  participantName: string;
}
