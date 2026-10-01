import { Test, TestingModule } from '@nestjs/testing';
import { RmqContext } from '@nestjs/microservices';
import { of, throwError } from 'rxjs';
import { FinanceSaleEventsController } from './finance-sale-events.controller.ts';
import { ProductsService } from './products.service.js';
import { PRODUCTS_EVENTS_CLIENT } from '../config/index.ts';
import { FinanceEvents } from '../common/index.ts';

const saleId = '5f0c6b8e-1d3a-4f6e-9b2a-7c1d2e3f4a5b';
const organization_id = '6abd26a42d059ac027376ca1';

function createContext(redelivered = false) {
  const channel = { ack: vi.fn(), nack: vi.fn() };
  const message = { fields: { redelivered } };
  const context = new RmqContext([message, channel, FinanceEvents.SaleRegistered]);
  return { channel, message, context };
}

describe('FinanceSaleEventsController', () => {
  let controller: FinanceSaleEventsController;
  const productsService = { consumeSale: vi.fn() };
  const eventsClient = { emit: vi.fn() };
  const event = { organization_id, saleId, consumos: [{ producto_id: 7, cantidad: 1 }] };

  beforeEach(async () => {
    vi.resetAllMocks();
    eventsClient.emit.mockReturnValue(of(undefined));

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FinanceSaleEventsController],
      providers: [
        { provide: ProductsService, useValue: productsService },
        { provide: PRODUCTS_EVENTS_CLIENT, useValue: eventsClient },
      ],
    }).compile();

    controller = module.get(FinanceSaleEventsController);
  });

  it('answers finance.sale.stock.applied and acks once the stock is discounted', async () => {
    productsService.consumeSale.mockResolvedValue({ applied: true });
    const { channel, message, context } = createContext();

    await controller.handleSaleRegistered(event, context);

    expect(productsService.consumeSale).toHaveBeenCalledWith(expect.objectContaining({ organization_id, saleId }));
    expect(eventsClient.emit).toHaveBeenCalledWith(FinanceEvents.SaleStockApplied, { organization_id, saleId });
    expect(channel.ack).toHaveBeenCalledWith(message);
  });

  it('answers finance.sale.stock.rejected with the reason and acks', async () => {
    productsService.consumeSale.mockResolvedValue({ applied: false, reason: 'Insufficient stock for product #7' });
    const { channel, message, context } = createContext();

    await controller.handleSaleRegistered(event, context);

    expect(eventsClient.emit).toHaveBeenCalledWith(FinanceEvents.SaleStockRejected, {
      organization_id,
      saleId,
      reason: 'Insufficient stock for product #7',
    });
    expect(channel.ack).toHaveBeenCalledWith(message);
  });

  it('dead-letters an invalid payload without touching the stock', async () => {
    const { channel, message, context } = createContext();

    await controller.handleSaleRegistered({ organization_id, saleId, consumos: [] }, context);

    expect(productsService.consumeSale).not.toHaveBeenCalled();
    expect(channel.nack).toHaveBeenCalledWith(message, false, false);
  });

  it('requeues once when the reply cannot be published, then dead-letters', async () => {
    productsService.consumeSale.mockResolvedValue({ applied: true });
    eventsClient.emit.mockReturnValue(throwError(() => new Error('broker down')));

    const first = createContext(false);
    await controller.handleSaleRegistered(event, first.context);
    const second = createContext(true);
    await controller.handleSaleRegistered(event, second.context);

    expect(first.channel.nack).toHaveBeenCalledWith(first.message, false, true);
    expect(second.channel.nack).toHaveBeenCalledWith(second.message, false, false);
  });
});
