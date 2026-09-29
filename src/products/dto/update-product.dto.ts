import { OmitType, PartialType } from '@nestjs/mapped-types';
import { IsInt, IsPositive } from 'class-validator';
import { CreateProductDto } from './create-product.dto.js';

// stock_actual only changes through AdjustStock, which records the history
export class UpdateProductDto extends PartialType(OmitType(CreateProductDto, ['stock_actual'] as const)) {
  @IsInt()
  @IsPositive()
  public id: number;
}
