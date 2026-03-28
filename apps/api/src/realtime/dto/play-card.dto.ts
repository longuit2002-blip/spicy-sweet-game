import { IsString, MinLength, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { DeclarationDto } from "./declaration.dto.js";

export class PlayCardDto {
  @IsString()
  @MinLength(1)
  cardId!: string;

  @ValidateNested()
  @Type(() => DeclarationDto)
  declaration!: DeclarationDto;
}
