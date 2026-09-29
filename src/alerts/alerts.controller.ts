import { Controller } from '@nestjs/common';
import { GrpcMethod, Payload } from '@nestjs/microservices';
import { AlertsService } from './alerts.service.ts';
import { FindAlertsDto } from './dto/find-alerts.dto.ts';
import { PRODUCTS_SERVICE_NAME } from '../generated/proto/products.ts';

// Served by the same gRPC ProductsService as the catalog
@Controller()
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) { }

  @GrpcMethod(PRODUCTS_SERVICE_NAME, 'FindAlerts')
  findAll(@Payload() findAlertsDto: FindAlertsDto) {
    return this.alertsService.findAll(findAlertsDto);
  }
}
