import { Controller, Inject, Logger } from '@nestjs/common';
import {
  ClientProxy,
  Ctx,
  EventPattern,
  Payload,
  RmqContext,
  RpcException,
  Transport,
} from '@nestjs/microservices';
import type { ClassConstructor } from 'class-transformer';
import { status } from '@grpc/grpc-js';
import { lastValueFrom, timeout } from 'rxjs';
import { ProductsService } from './products.service.js';
import { PRODUCTS_EVENTS_CLIENT, PUBLISH_TIMEOUT_MS } from '../config/index.ts';
import {
  parseEvent,
  PurchaseOrderCreatedEvent,
  PurchaseOrderEvents,
  PurchaseOrderReceivedEvent,
  rmqMessage,
  type PurchaseOrderProductRejectedEvent,
  type PurchaseOrderProductValidatedEvent,
} from '../common/index.ts';

type ValidationReply =
  | { pattern: typeof PurchaseOrderEvents.ProductValidated; data: PurchaseOrderProductValidatedEvent }
  | { pattern: typeof PurchaseOrderEvents.ProductRejected; data: PurchaseOrderProductRejectedEvent };

// Purchase order saga steps owned by products-ms: validate the product of a new
// order and add the stock of a received one
@Controller()
export class PurchaseOrderEventsController {
  private readonly logger = new Logger(PurchaseOrderEventsController.name);

  constructor(
    private readonly productsService: ProductsService,
    @Inject(PRODUCTS_EVENTS_CLIENT) private readonly eventsClient: ClientProxy,
  ) { }

  // <string> selects the untyped overload; the typed one forbids a typed @Ctx() argument
  @EventPattern<string>(PurchaseOrderEvents.Created, Transport.RMQ)
  handlePurchaseOrderCreated(@Payload() payload: unknown, @Ctx() context: RmqContext) {
    return this.process(PurchaseOrderEvents.Created, PurchaseOrderCreatedEvent, payload, context,
      async (event) => {
        const reply = await this.validatePurchaseOrder(event);
        // ack only once the broker confirmed the reply (at-least-once)
        await lastValueFrom(
          this.eventsClient.emit(reply.pattern, reply.data).pipe(timeout(PUBLISH_TIMEOUT_MS)),
          { defaultValue: undefined },
        );
      });
  }

  // Idempotent: a redelivered event does not add the stock twice
  @EventPattern<string>(PurchaseOrderEvents.Received, Transport.RMQ)
  handlePurchaseOrderReceived(@Payload() payload: unknown, @Ctx() context: RmqContext) {
    return this.process(PurchaseOrderEvents.Received, PurchaseOrderReceivedEvent, payload, context,
      (event) => this.productsService.receivePurchaseOrder(event));
  }

  // Invalid payloads are dead-lettered straight away; a processing error is
  // retried once through the queue and dead-lettered on the second failure
  private async process<T extends { purchaseOrderId: string }>(
    pattern: string,
    cls: ClassConstructor<T>,
    payload: unknown,
    context: RmqContext,
    handler: (event: T) => Promise<unknown>,
  ) {
    const message = rmqMessage(context);

    const parsed = await parseEvent(cls, payload);
    if ('errors' in parsed) {
      this.logger.error(`Invalid ${pattern} payload, dead-lettering: ${parsed.errors}`);
      message.nack(false);
      return;
    }

    try {
      await handler(parsed.event);
      message.ack();
    } catch (error) {
      const requeue = !message.redelivered;
      this.logger.error(
        `Failed to process ${pattern} for purchase order #${parsed.event.purchaseOrderId} (${requeue ? 'requeued' : 'dead-lettered'}): ${(error as Error)?.message ?? error}`,
      );
      message.nack(requeue);
    }
  }

  private async validatePurchaseOrder({ organization_id, purchaseOrderId, producto_id }: PurchaseOrderCreatedEvent): Promise<ValidationReply> {
    try {
      await this.productsService.validateProduct(organization_id, producto_id);
      return {
        pattern: PurchaseOrderEvents.ProductValidated,
        data: { organization_id, purchaseOrderId, producto_id },
      };
    } catch (error) {
      const rpcError = error instanceof RpcException
        ? (error.getError() as { code?: number; message?: string })
        : undefined;

      if (rpcError?.code !== status.INVALID_ARGUMENT) throw error;

      return {
        pattern: PurchaseOrderEvents.ProductRejected,
        data: { organization_id, purchaseOrderId, reason: rpcError.message ?? 'Invalid product' },
      };
    }
  }
}
