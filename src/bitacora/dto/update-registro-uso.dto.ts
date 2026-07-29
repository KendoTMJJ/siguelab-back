import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
  MaxLength,
} from 'class-validator';

const HORA_REGEX = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

/**
 * Todos los campos son opcionales (edición parcial). `idSolicitud` no es
 * editable a propósito — el enlace con la solicitud se fija al crear el
 * registro (ver BitacoraService.create); si el registro tiene una solicitud
 * enlazada, `idLaboratorio` debe seguir coincidiendo con la de esa solicitud
 * (ver BitacoraService.update).
 */
export class UpdateRegistroUsoDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  idLaboratorio?: number;

  @ApiPropertyOptional({ example: 1, description: 'id_tipo (tipo de reserva)' })
  @IsOptional()
  @IsInt()
  idTipo?: number;

  @ApiPropertyOptional({ example: '2026-08-10' })
  @IsOptional()
  @IsDateString()
  fecha?: string;

  @ApiPropertyOptional({ example: '08:00' })
  @IsOptional()
  @Matches(HORA_REGEX, { message: 'horaInicioReal debe tener formato HH:mm' })
  horaInicioReal?: string;

  @ApiPropertyOptional({ example: '10:00' })
  @IsOptional()
  @Matches(HORA_REGEX, { message: 'horaFinReal debe tener formato HH:mm' })
  horaFinReal?: string;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsInt()
  @Min(0)
  numAsistentes?: number;

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
