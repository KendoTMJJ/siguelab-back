import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';

export class CotizarServicioDto {
  @ApiProperty({
    example: [1, 3],
    description:
      'Equipo(s) real(es) que va a usar el servicio — decisión del técnico, no del solicitante',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsInt({ each: true })
  @IsPositive({ each: true })
  idsEquipos!: number[];

  @ApiPropertyOptional({ example: 'PLA blanco, 200g aprox.' })
  @IsOptional()
  @IsString()
  descripcionMaterial?: string;

  @ApiProperty({ example: 15000, minimum: 0 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  costoMaterial!: number;

  @ApiProperty({ example: 20000, minimum: 0 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  costoTiempoUso!: number;

  @ApiProperty({ example: 3000, minimum: 0 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  costoEnergia!: number;

  @ApiProperty({ example: 10000, minimum: 0 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  costoManoObra!: number;

  @ApiPropertyOptional({ example: 0, minimum: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  costosAdicionales?: number;

  @ApiPropertyOptional({ example: 5000, minimum: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  margen?: number;
}
