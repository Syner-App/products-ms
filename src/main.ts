import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.ts';
import { Transport, MicroserviceOptions, RpcException } from '@nestjs/microservices';
import { Logger, ValidationPipe } from '@nestjs/common';
import { status } from '@grpc/grpc-js';
import { join } from 'path';
import { envs, PURCHASE_ORDERS_QUEUE, SYNER_DLX, SYNER_EXCHANGE } from './config/index.ts';
import { PRODUCTS_PACKAGE_NAME } from './generated/proto/products.ts';
import { PrismaExceptionFilter } from './common/index.ts';

async function bootstrap() {
  const logger = new Logger('Main')

  // Hybrid app: gRPC for the gateway + RabbitMQ for the purchase order saga (no HTTP server)
  const app = await NestFactory.create(AppModule);

  // Global enhancers must be registered before connectMicroservice() so
  // inheritAppConfig can copy them to every microservice
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
  app.useGlobalFilters(new PrismaExceptionFilter());

  app.connectMicroservice<MicroserviceOptions>(
    {
      transport: Transport.GRPC,
      options: {
        package: PRODUCTS_PACKAGE_NAME,
        protoPath: join(import.meta.dirname, 'proto/products.proto'),
        url: `0.0.0.0:${envs.port}`,
        // snake_case fields and string enums, matching the Prisma models
        loader: { keepCase: true, enums: String },
      },
    },
    { inheritAppConfig: true },
  );

  app.connectMicroservice<MicroserviceOptions>(
    {
      transport: Transport.RMQ,
      options: {
        urls: [envs.rabbitmqUrl],
        queue: PURCHASE_ORDERS_QUEUE,
        queueOptions: {
          durable: true,
          arguments: {
            'x-dead-letter-exchange': SYNER_DLX,
            'x-dead-letter-routing-key': PURCHASE_ORDERS_QUEUE,
          },
        },
        exchange: SYNER_EXCHANGE,
        exchangeType: 'topic',
        wildcards: true,
        noAck: false,
        prefetchCount: 10,
      },
    },
    { inheritAppConfig: true },
  );

  // init() first so lifecycle hooks finish before any message is consumed
  await app.init();
  await app.startAllMicroservices();
  logger.log(`Products MS (gRPC) listening on port ${envs.port}`);
  logger.log(`Products MS (RMQ) consuming queue ${PURCHASE_ORDERS_QUEUE}`);
}
await bootstrap();
