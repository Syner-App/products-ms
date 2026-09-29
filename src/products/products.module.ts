import { Module } from '@nestjs/common';
import { ProductsService } from './products.service.js';
import { ProductsController } from './products.controller.js';
import { PurchaseOrderEventsController } from './purchase-order-events.controller.ts';
import { RabbitMQModule } from '../transport/rabbitmq.module.ts';

@Module({
  imports: [RabbitMQModule],
  controllers: [ProductsController, PurchaseOrderEventsController],
  providers: [ProductsService],
})
export class ProductsModule {}
