import { IsEnum, IsInt, IsNotEmpty, IsPositive, IsString } from 'class-validator';
import { TypeProductHistory } from '../../generated/prisma/enums.ts';

export class AdjustStockDto {
    @IsInt()
    @IsPositive()
    public id: number;

    @IsEnum(TypeProductHistory, {
        message: `Possible tipo values are ${Object.values(TypeProductHistory).join(', ')}`,
    })
    public tipo: TypeProductHistory;

    @IsInt()
    @IsPositive()
    public cantidad: number;

    @IsString()
    @IsNotEmpty()
    public motivo: string;
}
