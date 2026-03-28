import { IsBoolean, IsInt, IsOptional, Max, Min } from "class-validator";

export class RoomCreateDto {
  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(8)
  maxPlayers?: number;

  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean;
}
