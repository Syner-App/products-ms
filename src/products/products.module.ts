import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ProductsService } from './products.service.js';
import { ProductsController } from './products.controller.js';
import { OrderValidationController } from './order-validation.controller.ts';
import { PrismaService } from '../prisma-service/prisma-service.service.ts';
import { envs, PRODUCTS_EVENTS_CLIENT, SYNER_EXCHANGE } from '../config/index.ts';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: PRODUCTS_EVENTS_CLIENT,
        transport: Transport.RMQ,
        options: {
          urls: [envs.rabbitmqUrl],
          exchange: SYNER_EXCHANGE,
          exchangeType: 'topic',
          // Publish to the exchange using the event pattern as routing key
          wildcards: true,
          persistent: true,
        },
      },
    ]),
  ],
  controllers: [ProductsController, OrderValidationController],
  providers: [ProductsService, PrismaService],
})
export class ProductsModule {}
