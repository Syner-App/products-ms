import { Test, TestingModule } from '@nestjs/testing';
import { RmqContext, RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import { of, throwError } from 'rxjs';
import { PurchaseOrderEventsController } from './purchase-order-events.controller.ts';
import { ProductsService } from './products.service.js';
import { PRODUCTS_EVENTS_CLIENT } from '../config/index.ts';
import { PurchaseOrderEvents } from '../common/index.ts';

const purchaseOrderId = '6f1c1c9e-2f5b-4c1a-9a47-6a2b1f3c8d10';

function createContext(redelivered = false) {
  const channel = { ack: vi.fn(), nack: vi.fn() };
  const message = { fields: { redelivered } };
  const context = new RmqContext([message, channel, PurchaseOrderEvents.Created]);
  return { channel, message, context };
}

describe('PurchaseOrderEventsController', () => {
  let controller: PurchaseOrderEventsController;
  const productsService = { validateProduct: vi.fn(), receivePurchaseOrder: vi.fn() };
  const eventsClient = { emit: vi.fn() };

  beforeEach(async () => {
    vi.resetAllMocks();
    eventsClient.emit.mockReturnValue(of(undefined));

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PurchaseOrderEventsController],
      providers: [
        { provide: ProductsService, useValue: productsService },
        { provide: PRODUCTS_EVENTS_CLIENT, useValue: eventsClient },
      ],
    }).compile();

    controller = module.get(PurchaseOrderEventsController);
  });

  describe('purchase-order.created', () => {
    const event = { purchaseOrderId, producto_id: 1, cantidad_solicitada: 10 };

    it('publishes purchase-order.product.validated and acks when the product is valid', async () => {
      productsService.validateProduct.mockResolvedValue({ id: 1, activo: true });
      const { channel, message, context } = createContext();

      await controller.handlePurchaseOrderCreated(event, context);

      expect(productsService.validateProduct).toHaveBeenCalledWith(1);
      expect(eventsClient.emit).toHaveBeenCalledWith(PurchaseOrderEvents.ProductValidated, {
        purchaseOrderId,
        producto_id: 1,
      });
      expect(channel.ack).toHaveBeenCalledWith(message);
      expect(channel.nack).not.toHaveBeenCalled();
    });

    it('publishes purchase-order.product.rejected and acks when the product is invalid', async () => {
      productsService.validateProduct.mockRejectedValue(
        new RpcException({ code: status.INVALID_ARGUMENT, message: 'Product #9 not found or inactive' }),
      );
      const { channel, message, context } = createContext();

      await controller.handlePurchaseOrderCreated({ ...event, producto_id: 9 }, context);

      expect(eventsClient.emit).toHaveBeenCalledWith(PurchaseOrderEvents.ProductRejected, {
        purchaseOrderId,
        reason: 'Product #9 not found or inactive',
      });
      expect(channel.ack).toHaveBeenCalledWith(message);
    });

    it('dead-letters an invalid payload without touching the database', async () => {
      const { channel, message, context } = createContext();

      await controller.handlePurchaseOrderCreated({ purchaseOrderId: 'not-a-uuid', producto_id: 1 }, context);

      expect(productsService.validateProduct).not.toHaveBeenCalled();
      expect(channel.nack).toHaveBeenCalledWith(message, false, false);
    });

    it('requeues on the first publish failure', async () => {
      productsService.validateProduct.mockResolvedValue({ id: 1, activo: true });
      eventsClient.emit.mockReturnValue(throwError(() => new Error('broker down')));
      const { channel, message, context } = createContext(false);

      await controller.handlePurchaseOrderCreated(event, context);

      expect(channel.ack).not.toHaveBeenCalled();
      expect(channel.nack).toHaveBeenCalledWith(message, false, true);
    });

    it('dead-letters a redelivered message that fails again', async () => {
      productsService.validateProduct.mockRejectedValue(new Error('database down'));
      const { channel, message, context } = createContext(true);

      await controller.handlePurchaseOrderCreated(event, context);

      expect(eventsClient.emit).not.toHaveBeenCalled();
      expect(channel.nack).toHaveBeenCalledWith(message, false, false);
    });
  });

  describe('purchase-order.received', () => {
    const event = { purchaseOrderId, producto_id: 1, cantidad: 25 };

    it('adds the stock and acks', async () => {
      productsService.receivePurchaseOrder.mockResolvedValue(true);
      const { channel, message, context } = createContext();

      await controller.handlePurchaseOrderReceived(event, context);

      expect(productsService.receivePurchaseOrder).toHaveBeenCalledWith(expect.objectContaining(event));
      expect(channel.ack).toHaveBeenCalledWith(message);
    });

    it('requeues once when the stock update fails', async () => {
      productsService.receivePurchaseOrder.mockRejectedValue(new Error('database down'));
      const { channel, message, context } = createContext(false);

      await controller.handlePurchaseOrderReceived(event, context);

      expect(channel.nack).toHaveBeenCalledWith(message, false, true);
    });

    it('dead-letters a payload without cantidad', async () => {
      const { channel, message, context } = createContext();

      await controller.handlePurchaseOrderReceived({ purchaseOrderId, producto_id: 1 }, context);

      expect(productsService.receivePurchaseOrder).not.toHaveBeenCalled();
      expect(channel.nack).toHaveBeenCalledWith(message, false, false);
    });
  });
});
