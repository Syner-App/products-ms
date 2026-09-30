import { IsInt, IsMongoId, IsPositive } from 'class-validator';

export class ProductByIdDto {
  // Organization of the authenticated caller, set by client-gateway from the verified token
  @IsMongoId()
  public organization_id: string;

  @IsInt()
  @IsPositive()
  public id: number;
}
