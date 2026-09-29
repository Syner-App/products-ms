import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsPositive,
  IsUUID,
  ValidateNested,
} from 'class-validator';

// Order saga contract. Keep in sync with orders-ms/src/common/events/order.events.ts
export const OrderEvents = {
  Created: 'order.created',
  ProductsValidated: 'order.products.validated',
  ProductsRejected: 'order.products.rejected',
} as const;

export class OrderCreatedItem {
  @IsInt()
  @IsPositive()
  productId: number;

  @IsInt()
  @IsPositive()
  quantity: number;
}

export class OrderCreatedEvent {
  @IsUUID()
  orderId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderCreatedItem)
  items: OrderCreatedItem[];
}

export interface OrderProductsValidatedEvent {
  orderId: string;
  products: { id: number; name: string; price: number }[];
}

export interface OrderProductsRejectedEvent {
  orderId: string;
  reason: string;
}
