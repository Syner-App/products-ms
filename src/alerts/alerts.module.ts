import { Module } from '@nestjs/common';
import { AlertsController } from './alerts.controller.ts';
import { AlertsService } from './alerts.service.ts';
import { AlertsClient } from './alerts.client.ts';
import { PrismaService } from '../prisma/prisma-service.service.ts';
import { RabbitMQModule } from '../transport/rabbitmq.module.ts';

@Module({
  imports: [RabbitMQModule],
  controllers: [AlertsController],
  providers: [AlertsService, AlertsClient, PrismaService],
  exports: [AlertsClient],
})
export class AlertsModule {}
