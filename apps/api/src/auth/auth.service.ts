import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../prisma/prisma.service";

export interface JwtPayload {
  sub: string;
  nickname: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async loginGuest(nickname: string) {
    const user = await this.prisma.user.create({
      data: { nickname: nickname.trim().slice(0, 32) },
    });
    const payload: JwtPayload = { sub: user.id, nickname: user.nickname };
    const accessToken = this.jwt.sign(payload);
    const refreshToken = this.jwt.sign(
      { sub: user.id, typ: "refresh" },
      { expiresIn: "7d" },
    );
    return {
      user: { id: user.id, nickname: user.nickname },
      accessToken,
      refreshToken,
    };
  }

  refreshAccessToken(refreshToken: string) {
    const decoded = this.jwt.verify<{ sub: string; typ?: string }>(refreshToken);
    if (decoded.typ !== "refresh") {
      throw new Error("Invalid refresh token");
    }
    return this.prisma.user.findUnique({ where: { id: decoded.sub } }).then((user) => {
      if (!user) throw new Error("User not found");
      const payload: JwtPayload = { sub: user.id, nickname: user.nickname };
      return { accessToken: this.jwt.sign(payload) };
    });
  }
}
