import { ArrayMinSize, IsArray, IsInt, IsPositive } from 'class-validator';

export class ValidateProductsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  @IsPositive({ each: true })
  public ids: number[];
}
