import { IsInt, IsMongoId, IsPositive } from 'class-validator';

export class SyncLowStockAlertDto {
  @IsMongoId()
  public organization_id: string;

  @IsInt()
  @IsPositive()
  public product_id: number;
}
