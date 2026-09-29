import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../common/index.ts';
import { TypeCategory } from '../../generated/prisma/enums.ts';

export class FindProductsDto extends PaginationDto {
    @IsEnum(TypeCategory, {
        message: `Possible categoria values are ${Object.values(TypeCategory).join(', ')}`,
    })
    @IsOptional()
    public categoria?: TypeCategory;

    @IsString()
    @IsOptional()
    public proveedor?: string;

    @IsString()
    @IsOptional()
    public nombre?: string;

    // Defaults to true: inactive products are only listed when asked for
    @IsBoolean()
    @IsOptional()
    public activo?: boolean;

    @IsBoolean()
    @IsOptional()
    public stock_bajo?: boolean;
}
