import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.ts';
import { Transport, MicroserviceOptions, RpcException } from '@nestjs/microservices';
import { Logger, ValidationPipe } from '@nestjs/common';
import { status } from '@grpc/grpc-js';
import { join } from 'path';
import { envs } from './config/envs.ts';
import { PRODUCTS_PACKAGE_NAME } from './generated/proto/products.ts';

async function bootstrap() {
  const logger = new Logger('Main')
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
    transport: Transport.GRPC,
    options: {
      package: PRODUCTS_PACKAGE_NAME,
      protoPath: join(import.meta.dirname, 'proto/products.proto'),
      url: `0.0.0.0:${envs.port}`,
    }
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) =>
        new RpcException({
          code: status.INVALID_ARGUMENT,
          message: errors
            .flatMap((error) => Object.values(error.constraints ?? {}))
            .join(', '),
        }),
    })
  )
  await app.listen();
  logger.log(`Products MS (gRPC) listening on port ${envs.port}`);
}
await bootstrap();
