import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class ExportarAsistenciasQueryDto {
  @ApiPropertyOptional({
    example: 1,
    description:
      'Filtra por periodo académico. Si no viene (ni fechaDesde/fechaHasta), exporta el periodo activo (fecha_inicio <= hoy <= fecha_fin) o, si ninguno está activo, el más reciente.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  idPeriodo?: number;

  @ApiPropertyOptional({ example: '2026-07-20' })
  @IsOptional()
  @IsDateString()
  fechaDesde?: string;

  @ApiPropertyOptional({ example: '2026-11-20' })
  @IsOptional()
  @IsDateString()
  fechaHasta?: string;
}
