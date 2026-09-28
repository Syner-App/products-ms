import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.ts';
import { ValidationPipe } from '@nestjs/common';
import { envs } from './config/envs.ts';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {});
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true
    })
  )
  await app.listen(envs.port);
}
await bootstrap();
