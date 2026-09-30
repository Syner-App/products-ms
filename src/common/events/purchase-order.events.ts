import { IsInt, IsMongoId, IsPositive, IsUUID } from 'class-validator';

// Purchase order saga contract. Keep in sync with orders-ms/src/common/events/purchase-order.events.ts.
// Every event carries the organization of the purchase order, so each step runs scoped to it
export const PurchaseOrderEvents = {
  Created: 'purchase-order.created',
  ProductValidated: 'purchase-order.product.validated',
  ProductRejected: 'purchase-order.product.rejected',
  Received: 'purchase-order.received',
} as const;

export class PurchaseOrderCreatedEvent {
  @IsMongoId()
  organization_id: string;

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
  @IsMongoId()
  organization_id: string;

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
  organization_id: string;
  purchaseOrderId: string;
  producto_id: number;
}

export interface PurchaseOrderProductRejectedEvent {
  organization_id: string;
  purchaseOrderId: string;
  reason: string;
}
