import { IsEnum, IsMongoId, IsOptional } from 'class-validator';
import { PaginationDto } from '../../common/index.ts';
import { StatusAlert } from '../../generated/prisma/enums.ts';

export class FindAlertsDto extends PaginationDto {
  // Organization of the authenticated caller, set by client-gateway from the verified token
  @IsMongoId()
  public organization_id: string;

  @IsEnum(StatusAlert, {
    message: `Possible estado values are ${Object.values(StatusAlert).join(', ')}`,
  })
  @IsOptional()
  public estado?: StatusAlert;
}
