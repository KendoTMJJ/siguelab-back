import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

export class CreateRegistroUsoDto {
  @ApiPropertyOptional({
    example: 1,
    description: 'Solicitud aprobada que originó el uso (opcional)',
  })
  @IsOptional()
  @IsInt()
  idSolicitud?: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  idLaboratorio!: number;

  @ApiProperty({ example: 1, description: 'id_tipo (tipo de reserva)' })
  @IsInt()
  idTipo!: number;

  @ApiProperty({ example: '2026-08-10' })
  @IsDateString()
  fecha!: string;

  @ApiProperty({ example: '08:00' })
  @Matches(HORA_REGEX, { message: 'horaInicioReal debe tener formato HH:mm' })
  horaInicioReal!: string;

  @ApiProperty({ example: '10:00' })
  @Matches(HORA_REGEX, { message: 'horaFinReal debe tener formato HH:mm' })
  horaFinReal!: string;

  @ApiPropertyOptional({ example: 10, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  numAsistentes?: number;

  @ApiPropertyOptional({ example: 'Docente ausente', maxLength: 60 })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  novedad?: string;

  @ApiPropertyOptional({ example: 'Se realizó la práctica sin novedad' })
  @IsOptional()
  @IsString()
  observaciones?: string;
}
