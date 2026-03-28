import { IsIn } from "class-validator";

const CHALLENGE_TYPES = ["suit", "number"] as const;

export class ChallengeDto {
  @IsIn(CHALLENGE_TYPES)
  challengeType!: (typeof CHALLENGE_TYPES)[number];
}
