import { Module } from '@nestjs/common';
import { ProductsService } from './products.service.js';
import { ProductsController } from './products.controller.js';
import { OrderValidationController } from './order-validation.controller.ts';
import { PrismaService } from '../prisma-service/prisma-service.service.ts';
import { RabbitMQModule } from '../transport/rabbitmq.module.ts';

@Module({
  imports: [RabbitMQModule],
  controllers: [ProductsController, OrderValidationController],
  providers: [ProductsService, PrismaService],
})
export class ProductsModule {}
