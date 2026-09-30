import { RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import { NEVER, of, throwError } from 'rxjs';
import { AlertsClient } from './alerts.client.ts';
import { AlertPatterns } from '../config/index.ts';

describe('AlertsClient', () => {
  const proxy = { send: vi.fn() };
  const client = new AlertsClient(proxy as never);

  const failure = () =>
    client.syncLowStock('6abd26a42d059ac027376ca1', 4).then(
      () => { throw new Error('expected a rejection'); },
      (e: unknown) => e as RpcException,
    );

  beforeEach(() => vi.resetAllMocks());
  afterEach(() => vi.useRealTimers());

  it('sends the request and waits for the reply', async () => {
    proxy.send.mockReturnValue(of({ ok: true }));

    await expect(client.syncLowStock('6abd26a42d059ac027376ca1', 4)).resolves.toBeUndefined();
    expect(proxy.send).toHaveBeenCalledWith(AlertPatterns.SyncLowStock, { organization_id: '6abd26a42d059ac027376ca1', product_id: 4 });
  });

  it('maps a consumer error to UNAVAILABLE', async () => {
    proxy.send.mockReturnValue(throwError(() => ({ code: status.NOT_FOUND, message: 'No Product found' })));

    const error = await failure();

    expect(error).toBeInstanceOf(RpcException);
    expect(error.getError()).toMatchObject({
      code: status.UNAVAILABLE,
      message: expect.stringContaining('No Product found'),
    });
  });

  it('maps a missing reply to DEADLINE_EXCEEDED', async () => {
    vi.useFakeTimers();
    proxy.send.mockReturnValue(NEVER);

    const pending = failure();
    await vi.advanceTimersByTimeAsync(5000);

    expect((await pending).getError()).toMatchObject({ code: status.DEADLINE_EXCEEDED });
  });
});
