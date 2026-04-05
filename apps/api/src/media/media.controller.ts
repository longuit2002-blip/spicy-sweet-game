import { Body, Controller, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import type { MediaTokenRequest, MediaTokenResponse } from "@sweet-spicy/shared-types";
import { MediaTokenDto } from "./dto/media-token.dto";
import { MediaService } from "./media.service";

interface JwtRequestUser {
  userId: string;
  nickname: string;
}

@Controller("media")
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post("token")
  @UseGuards(AuthGuard("jwt"))
  issueToken(
    @Req() request: { user: JwtRequestUser },
    @Body() body: MediaTokenDto,
  ): Promise<MediaTokenResponse> {
    const payload: MediaTokenRequest = { roomCode: body.roomCode };
    return this.mediaService.issueToken(
      request.user.userId,
      request.user.nickname,
      payload.roomCode,
    );
  }
}
