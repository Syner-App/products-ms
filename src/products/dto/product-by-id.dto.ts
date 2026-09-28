import { IsInt, IsPositive } from 'class-validator';

export class ProductByIdDto {
  @IsInt()
  @IsPositive()
  public id: number;
}
