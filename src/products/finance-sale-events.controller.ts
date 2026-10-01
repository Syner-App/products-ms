import { Controller, Inject, Logger } from '@nestjs/common';
import { ClientProxy, Ctx, EventPattern, Payload, RmqContext, Transport } from '@nestjs/microservices';
import { lastValueFrom, timeout } from 'rxjs';
import { ProductsService } from './products.service.js';
import { PRODUCTS_EVENTS_CLIENT, PUBLISH_TIMEOUT_MS } from '../config/index.ts';
import { FinanceEvents, parseEvent, rmqMessage, SaleRegisteredEvent } from '../common/index.ts';

// Sales registered in finance-ms: discounts the supplies of their recipes from the stock and
// answers finance.sale.stock.applied or .rejected. Arrives through products.purchase-orders:
// the RMQ server binds that queue to the pattern of every RMQ handler (wildcards)
@Controller()
export class FinanceSaleEventsController {
  private readonly logger = new Logger(FinanceSaleEventsController.name);

  constructor(
    private readonly productsService: ProductsService,
    @Inject(PRODUCTS_EVENTS_CLIENT) private readonly eventsClient: ClientProxy,
  ) { }

  // <string> selects the untyped overload; the typed one forbids a typed @Ctx() argument.
  // Invalid payloads are dead-lettered straight away; a processing error is retried once
  // through the queue and dead-lettered on the second failure
  @EventPattern<string>(FinanceEvents.SaleRegistered, Transport.RMQ)
  async handleSaleRegistered(@Payload() payload: unknown, @Ctx() context: RmqContext) {
    const message = rmqMessage(context);

    const parsed = await parseEvent(SaleRegisteredEvent, payload);
    if ('errors' in parsed) {
      this.logger.error(`Invalid ${FinanceEvents.SaleRegistered} payload, dead-lettering: ${parsed.errors}`);
      message.nack(false);
      return;
    }

    const { organization_id, saleId } = parsed.event;
    try {
      const result = await this.productsService.consumeSale(parsed.event);
      const reply = result.applied
        ? this.eventsClient.emit(FinanceEvents.SaleStockApplied, { organization_id, saleId })
        : this.eventsClient.emit(FinanceEvents.SaleStockRejected, { organization_id, saleId, reason: result.reason });

      // ack only once the broker confirmed the reply (at-least-once)
      await lastValueFrom(reply.pipe(timeout(PUBLISH_TIMEOUT_MS)), { defaultValue: undefined });
      message.ack();
    } catch (error) {
      const requeue = !message.redelivered;
      this.logger.error(
        `Failed to process ${FinanceEvents.SaleRegistered} for sale #${saleId} (${requeue ? 'requeued' : 'dead-lettered'}): ${(error as Error)?.message ?? error}`,
      );
      message.nack(requeue);
    }
  }
}
