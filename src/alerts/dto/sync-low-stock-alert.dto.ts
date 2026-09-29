import { IsInt, IsPositive } from 'class-validator';

export class SyncLowStockAlertDto {
  @IsInt()
  @IsPositive()
  public product_id: number;
}
