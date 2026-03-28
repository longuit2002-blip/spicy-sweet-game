import { IsIn, IsInt, Max, Min } from "class-validator";

const SPICE_TYPES = ["chili", "lemon", "avocado"] as const;

export class DeclarationDto {
  @IsIn(SPICE_TYPES)
  type!: (typeof SPICE_TYPES)[number];

  @IsInt()
  @Min(1)
  @Max(10)
  number!: number;
}
