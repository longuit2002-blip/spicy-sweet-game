import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";
import { getClientCorsOrigin } from "./config/client-origins";
import { RedisIoAdapter } from "./redis/redis-io.adapter";
import { RedisService } from "./redis/redis.service";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const redisService = app.get(RedisService);
  const redisIoAdapter = new RedisIoAdapter(redisService, app);
  app.useWebSocketAdapter(redisIoAdapter);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );
  app.enableCors({
    origin: getClientCorsOrigin(),
    credentials: true,
  });
  const port = process.env.PORT ?? "3001";
  await app.listen(port);
   
  console.log(`API listening on http://localhost:${port}`);
}

void bootstrap();
