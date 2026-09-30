import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsMongoId, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { TypeCategory } from '../../generated/prisma/enums.ts';

export class CreateProductDto {
    // Organization of the authenticated caller, set by client-gateway from the verified token
    @IsMongoId()
    public organization_id: string;

    @IsString()
    @IsNotEmpty()
    public nombre: string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(20)
    public codigo_sku: string;

    @IsEnum(TypeCategory, {
        message: `Possible categoria values are ${Object.values(TypeCategory).join(', ')}`,
    })
    public categoria: TypeCategory;

    @IsInt()
    @Min(0)
    @Type(() => Number)
    public precio: number;

    @IsInt()
    @Min(0)
    @IsOptional()
    @Type(() => Number)
    public stock_actual?: number;

    @IsInt()
    @Min(0)
    @IsOptional()
    @Type(() => Number)
    public stock_minimo?: number;

    @IsString()
    @IsNotEmpty()
    public proveedor: string;
}
