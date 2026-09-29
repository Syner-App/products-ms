import { IsInt, IsPositive, IsUUID } from 'class-validator';

// Purchase order saga contract. Keep in sync with orders-ms/src/common/events/purchase-order.events.ts
export const PurchaseOrderEvents = {
  Created: 'purchase-order.created',
  ProductValidated: 'purchase-order.product.validated',
  ProductRejected: 'purchase-order.product.rejected',
  Received: 'purchase-order.received',
} as const;

export class PurchaseOrderCreatedEvent {
  @IsUUID()
  purchaseOrderId: string;

  @IsInt()
  @IsPositive()
  producto_id: number;

  @IsInt()
  @IsPositive()
  cantidad_solicitada: number;
}

export class PurchaseOrderReceivedEvent {
  @IsUUID()
  purchaseOrderId: string;

  @IsInt()
  @IsPositive()
  producto_id: number;

  @IsInt()
  @IsPositive()
  cantidad: number;
}

export interface PurchaseOrderProductValidatedEvent {
  purchaseOrderId: string;
  producto_id: number;
}

export interface PurchaseOrderProductRejectedEvent {
  purchaseOrderId: string;
  reason: string;
}
