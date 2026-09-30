import { Controller } from '@nestjs/common';
import { GrpcMethod, MessagePattern, Payload, Transport } from '@nestjs/microservices';
import { AlertsService } from './alerts.service.ts';
import { FindAlertsDto } from './dto/find-alerts.dto.ts';
import { SyncLowStockAlertDto } from './dto/sync-low-stock-alert.dto.ts';
import { PRODUCTS_SERVICE_NAME } from '../generated/proto/products.ts';
import { AlertPatterns } from '../config/index.ts';

// Served by the same gRPC ProductsService as the catalog
@Controller()
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) { }

  @GrpcMethod(PRODUCTS_SERVICE_NAME, 'FindAlerts')
  findAll(@Payload() findAlertsDto: FindAlertsDto) {
    return this.alertsService.findAll(findAlertsDto);
  }

  // Request/reply over RabbitMQ (see AlertsClient): the reply unblocks the producer
  @MessagePattern(AlertPatterns.SyncLowStock, Transport.RMQ)
  async syncLowStock(@Payload() { organization_id, product_id }: SyncLowStockAlertDto) {
    await this.alertsService.syncLowStock(organization_id, product_id);
    return { ok: true };
  }
}
