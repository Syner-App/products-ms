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
import { status } from '@grpc/grpc-js';
import { lastValueFrom, timeout } from 'rxjs';
import { ProductsService } from './products.service.js';
import { PRODUCTS_EVENTS_CLIENT, PUBLISH_TIMEOUT_MS } from '../config/index.ts';
import {
  OrderCreatedEvent,
  OrderEvents,
  parseEvent,
  rmqMessage,
  type OrderProductsRejectedEvent,
  type OrderProductsValidatedEvent,
} from '../common/index.ts';

type OrderValidationReply =
  | { pattern: typeof OrderEvents.ProductsValidated; data: OrderProductsValidatedEvent }
  | { pattern: typeof OrderEvents.ProductsRejected; data: OrderProductsRejectedEvent };

// Order saga step: validates the products of a new order and replies with
// order.products.validated or order.products.rejected
@Controller()
export class OrderValidationController {
  private readonly logger = new Logger(OrderValidationController.name);

  constructor(
    private readonly productsService: ProductsService,
    @Inject(PRODUCTS_EVENTS_CLIENT) private readonly eventsClient: ClientProxy,
  ) { }

  // <string> selects the untyped overload; the typed one forbids a typed @Ctx() argument
  @EventPattern<string>(OrderEvents.Created, Transport.RMQ)
  async handleOrderCreated(@Payload() payload: unknown, @Ctx() context: RmqContext) {
    const message = rmqMessage(context);

    const parsed = await parseEvent(OrderCreatedEvent, payload);
    if ('errors' in parsed) {
      this.logger.error(`Invalid ${OrderEvents.Created} payload, dead-lettering: ${parsed.errors}`);
      message.nack(false);
      return;
    }

    try {
      const reply = await this.validateOrder(parsed.event);
      // ack only once the broker confirmed the reply (at-least-once)
      await lastValueFrom(
        this.eventsClient.emit(reply.pattern, reply.data).pipe(timeout(PUBLISH_TIMEOUT_MS)),
        { defaultValue: undefined },
      );
      message.ack();
    } catch (error) {
      // Retry once through the queue; a second failure goes to the DLQ
      const requeue = !message.redelivered;
      this.logger.error(
        `Failed to process order #${parsed.event.orderId} (${requeue ? 'requeued' : 'dead-lettered'}): ${(error as Error)?.message ?? error}`,
      );
      message.nack(requeue);
    }
  }

  private async validateOrder({ orderId, items }: OrderCreatedEvent): Promise<OrderValidationReply> {
    try {
      const products = await this.productsService.validateProducts(
        items.map((item) => item.productId),
      );
      return {
        pattern: OrderEvents.ProductsValidated,
        data: {
          orderId,
          products: products.map(({ id, name, price }) => ({ id, name, price })),
        },
      };
    } catch (error) {
      const rpcError = error instanceof RpcException
        ? (error.getError() as { code?: number; message?: string })
        : undefined;

      if (rpcError?.code !== status.INVALID_ARGUMENT) throw error;

      return {
        pattern: OrderEvents.ProductsRejected,
        data: { orderId, reason: rpcError.message ?? 'Invalid products' },
      };
    }
  }
}
