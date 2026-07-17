import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Whitelist estricta a propósito: solo novedad/observaciones son editables
 * (fecha, horas y demás son inmutables una vez registrado el uso real).
 */
export class UpdateRegistroUsoDto {
  @ApiPropertyOptional({ example: 'Clase cancelada', maxLength: 60 })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  novedad?: string;

  @ApiPropertyOptional({ example: 'Se reprogramó para la próxima semana' })
  @IsOptional()
  @IsString()
  observaciones?: string;
}
