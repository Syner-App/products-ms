import { Test, TestingModule } from '@nestjs/testing';
import { RmqContext, RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import { of, throwError } from 'rxjs';
import { OrderValidationController } from './order-validation.controller.ts';
import { ProductsService } from './products.service.js';
import { PRODUCTS_EVENTS_CLIENT } from '../config/index.ts';
import { OrderEvents } from '../common/index.ts';

const orderId = '6f1c1c9e-2f5b-4c1a-9a47-6a2b1f3c8d10';

function createContext(redelivered = false) {
  const channel = { ack: vi.fn(), nack: vi.fn() };
  const message = { fields: { redelivered } };
  const context = new RmqContext([message, channel, OrderEvents.Created]);
  return { channel, message, context };
}

describe('OrderValidationController', () => {
  let controller: OrderValidationController;
  const productsService = { validateProducts: vi.fn() };
  const eventsClient = { emit: vi.fn() };

  beforeEach(async () => {
    vi.resetAllMocks();
    eventsClient.emit.mockReturnValue(of(undefined));

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrderValidationController],
      providers: [
        { provide: ProductsService, useValue: productsService },
        { provide: PRODUCTS_EVENTS_CLIENT, useValue: eventsClient },
      ],
    }).compile();

    controller = module.get(OrderValidationController);
  });

  it('publishes order.products.validated and acks when every product is valid', async () => {
    productsService.validateProducts.mockResolvedValue([
      { id: 1, name: 'Keyboard', price: 50, available: true },
      { id: 2, name: 'Mouse', price: 20, available: true },
    ]);
    const { channel, message, context } = createContext();

    await controller.handleOrderCreated(
      { orderId, items: [{ productId: 1, quantity: 2 }, { productId: 2, quantity: 1 }] },
      context,
    );

    expect(productsService.validateProducts).toHaveBeenCalledWith([1, 2]);
    expect(eventsClient.emit).toHaveBeenCalledWith(OrderEvents.ProductsValidated, {
      orderId,
      products: [
        { id: 1, name: 'Keyboard', price: 50 },
        { id: 2, name: 'Mouse', price: 20 },
      ],
    });
    expect(channel.ack).toHaveBeenCalledWith(message);
    expect(channel.nack).not.toHaveBeenCalled();
  });

  it('publishes order.products.rejected and acks when a product is invalid', async () => {
    productsService.validateProducts.mockRejectedValue(
      new RpcException({ code: status.INVALID_ARGUMENT, message: 'Products not found or unavailable: #9' }),
    );
    const { channel, message, context } = createContext();

    await controller.handleOrderCreated({ orderId, items: [{ productId: 9, quantity: 1 }] }, context);

    expect(eventsClient.emit).toHaveBeenCalledWith(OrderEvents.ProductsRejected, {
      orderId,
      reason: 'Products not found or unavailable: #9',
    });
    expect(channel.ack).toHaveBeenCalledWith(message);
  });

  it('dead-letters an invalid payload without touching the database', async () => {
    const { channel, message, context } = createContext();

    await controller.handleOrderCreated({ orderId: 'not-a-uuid', items: [] }, context);

    expect(productsService.validateProducts).not.toHaveBeenCalled();
    expect(channel.nack).toHaveBeenCalledWith(message, false, false);
  });

  it('requeues on the first publish failure', async () => {
    productsService.validateProducts.mockResolvedValue([{ id: 1, name: 'Keyboard', price: 50 }]);
    eventsClient.emit.mockReturnValue(throwError(() => new Error('broker down')));
    const { channel, message, context } = createContext(false);

    await controller.handleOrderCreated({ orderId, items: [{ productId: 1, quantity: 1 }] }, context);

    expect(channel.ack).not.toHaveBeenCalled();
    expect(channel.nack).toHaveBeenCalledWith(message, false, true);
  });

  it('dead-letters a redelivered message that fails again', async () => {
    productsService.validateProducts.mockRejectedValue(new Error('database locked'));
    const { channel, message, context } = createContext(true);

    await controller.handleOrderCreated({ orderId, items: [{ productId: 1, quantity: 1 }] }, context);

    expect(eventsClient.emit).not.toHaveBeenCalled();
    expect(channel.nack).toHaveBeenCalledWith(message, false, false);
  });
});
