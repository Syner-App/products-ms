import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import { lastValueFrom, timeout, TimeoutError } from 'rxjs';
import { ALERT_RPC_TIMEOUT_MS, ALERTS_CLIENT, AlertPatterns } from '../config/index.ts';
import type { SyncLowStockAlertDto } from './dto/sync-low-stock-alert.dto.ts';

// Synchronous alert sync over RabbitMQ: send() waits for the consumer's reply.
// Failures surface as gRPC errors so the gateway gets a meaningful status code
@Injectable()
export class AlertsClient {
  constructor(@Inject(ALERTS_CLIENT) private readonly client: ClientProxy) { }

  async syncLowStock(organization_id: string, product_id: number): Promise<void> {
    const payload: SyncLowStockAlertDto = { organization_id, product_id };

    try {
      await lastValueFrom(
        this.client.send(AlertPatterns.SyncLowStock, payload).pipe(timeout(ALERT_RPC_TIMEOUT_MS)),
      );
    } catch (error) {
      if (error instanceof TimeoutError) {
        throw new RpcException({
          code: status.DEADLINE_EXCEEDED,
          message: `Low stock alert sync for product #${product_id} timed out`,
        });
      }
      throw new RpcException({
        code: status.UNAVAILABLE,
        message: `Low stock alert sync for product #${product_id} failed: ${errorMessage(error)}`,
      });
    }
  }
}

// The consumer replies with the serialized RpcException error ({ code, message } or a string)
const errorMessage = (error: unknown): string => {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  const message = (error as { message?: unknown } | null)?.message;
  return typeof message === 'string' ? message : 'unknown error';
};
