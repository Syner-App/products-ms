import { Module } from '@nestjs/common';
import { ProductsService } from './products.service.js';
import { ProductsController } from './products.controller.js';
import { PurchaseOrderEventsController } from './purchase-order-events.controller.ts';
import { RabbitMQModule } from '../transport/rabbitmq.module.ts';
import { PrismaService } from '../prisma/prisma-service.service.ts';
import { AlertsModule } from '../alerts/alerts.module.ts';

@Module({
  imports: [RabbitMQModule, AlertsModule],
  controllers: [ProductsController, PurchaseOrderEventsController],
  providers: [ProductsService, PrismaService],
})
export class ProductsModule {}
