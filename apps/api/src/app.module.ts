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
import { AppController } from "./app.controller";

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
    PrismaModule,
    AuthModule,
    RoomModule,
    RealtimeModule,
    GameLoopModule,
  ],
})
export class AppModule {}
