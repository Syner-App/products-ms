import { OmitType, PartialType } from '@nestjs/mapped-types';
import { IsInt, IsMongoId, IsPositive } from 'class-validator';
import { CreateProductDto } from './create-product.dto.js';

// stock_actual only changes through AdjustStock, which records the history.
// organization_id stays required: it scopes the update, it is never changed
export class UpdateProductDto extends PartialType(
  OmitType(CreateProductDto, ['stock_actual', 'organization_id'] as const),
) {
  @IsMongoId()
  public organization_id: string;

  @IsInt()
  @IsPositive()
  public id: number;
}
