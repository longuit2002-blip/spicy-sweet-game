import { Body, Controller, Post, UnauthorizedException } from "@nestjs/common";
import { IsNotEmpty, IsString, MaxLength } from "class-validator";
import { AuthService } from "./auth.service";

class GuestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  nickname!: string;
}

class RefreshDto {
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("guest")
  async guest(@Body() body: GuestDto) {
    const data = await this.auth.loginGuest(body.nickname);
    return { success: true as const, data };
  }

  @Post("refresh")
  async refresh(@Body() body: RefreshDto) {
    try {
      const data = await this.auth.refreshAccessToken(body.refreshToken);
      return { success: true as const, data };
    } catch {
      throw new UnauthorizedException("Invalid refresh token");
    }
  }
}
