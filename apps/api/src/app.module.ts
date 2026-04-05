import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { RoomModule } from "./room/room.module";
import { RealtimeModule } from "./realtime/realtime.module";
import { GameLoopModule } from "./game/game-loop.module";
import { RedisModule } from "./redis/redis.module";
import { AppController } from "./app.controller";
import { MediaModule } from "./media/media.module";

@Module({
  controllers: [AppController],
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PassportModule.register({ defaultStrategy: "jwt" }),
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET ?? "sweet-spicy-dev-secret-change-me",
      signOptions: { expiresIn: "15m" },
    }),
    RedisModule,
    PrismaModule,
    AuthModule,
    RoomModule,
    MediaModule,
    RealtimeModule,
    GameLoopModule,
  ],
})
export class AppModule {}
