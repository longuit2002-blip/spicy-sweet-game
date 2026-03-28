import { IsString, MaxLength, MinLength } from "class-validator";
import { CHAT_MESSAGE_MAX_LENGTH } from "@sweet-spicy/shared-types";

export class ChatSendDto {
  @IsString()
  @MinLength(1)
  @MaxLength(CHAT_MESSAGE_MAX_LENGTH)
  content!: string;
}
