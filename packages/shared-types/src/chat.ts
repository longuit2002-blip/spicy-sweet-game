/** Max UTF-16 units stored per chat line (API + DTO). */
export const CHAT_MESSAGE_MAX_LENGTH = 200;

export interface ChatMessage {
  id: string;
  playerId: string;
  nickname: string;
  content: string;
  type: "text" | "system" | "emoji";
  timestamp: string;
}
