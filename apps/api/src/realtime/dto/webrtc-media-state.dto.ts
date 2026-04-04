import { IsBoolean } from "class-validator";

export class WebrtcMediaStateDto {
  @IsBoolean()
  audioEnabled!: boolean;

  @IsBoolean()
  videoEnabled!: boolean;
}
