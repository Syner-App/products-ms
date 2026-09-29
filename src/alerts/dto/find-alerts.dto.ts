import { IsEnum, IsOptional } from 'class-validator';
import { PaginationDto } from '../../common/index.ts';
import { StatusAlert } from '../../generated/prisma/enums.ts';

export class FindAlertsDto extends PaginationDto {
  @IsEnum(StatusAlert, {
    message: `Possible estado values are ${Object.values(StatusAlert).join(', ')}`,
  })
  @IsOptional()
  public estado?: StatusAlert;
}
