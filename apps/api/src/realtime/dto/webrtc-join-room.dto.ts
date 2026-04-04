import { IsBoolean, IsOptional, IsString } from "class-validator";

export class WebrtcJoinRoomDto {
  @IsOptional()
  @IsString()
  roomCode?: string;

  @IsBoolean()
  audioEnabled!: boolean;

  @IsBoolean()
  videoEnabled!: boolean;
}
