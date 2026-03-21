export interface ChatMessage {
  id: string;
  playerId: string;
  nickname: string;
  content: string;
  type: "text" | "system" | "emoji";
  timestamp: string;
}
