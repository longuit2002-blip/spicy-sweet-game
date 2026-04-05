import { IsNotEmpty, IsString, MaxLength, MinLength } from "class-validator";
import {
  ROOM_CODE_MAX_LENGTH,
  ROOM_CODE_MIN_LENGTH,
} from "@sweet-spicy/shared-types";

export class MediaTokenDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(ROOM_CODE_MIN_LENGTH)
  @MaxLength(ROOM_CODE_MAX_LENGTH)
  roomCode!: string;
}
