import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import {
  ModalidadEvento,
  PrioridadEvento,
} from '../entities/evento-laboratorio.entity';

const HORA_REGEX = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

export class CreateEventoLaboratorioDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @IsPositive()
  idLaboratorio!: number;

  @ApiProperty({ example: 'Ing. Laura Gómez', maxLength: 150 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  responsable!: string;

  @ApiProperty({
    example: 'Dirección de Bienestar Universitario',
    maxLength: 150,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  dependenciaSolicitante!: string;

  @ApiProperty({ example: '2026-09-10' })
  @IsDateString()
  fecha!: string;

  @ApiProperty({ example: '08:00' })
  @Matches(HORA_REGEX, { message: 'horaInicio debe tener formato HH:mm' })
  horaInicio!: string;

  @ApiProperty({ example: '12:00' })
  @Matches(HORA_REGEX, { message: 'horaFin debe tener formato HH:mm' })
  horaFin!: string;

  @ApiProperty({ example: 25 })
  @IsInt()
  @IsPositive()
  numAsistentes!: number;

  @ApiPropertyOptional({
    enum: PrioridadEvento,
    default: PrioridadEvento.NORMAL,
  })
  @IsOptional()
  @IsEnum(PrioridadEvento)
  prioridad?: PrioridadEvento;

  @ApiPropertyOptional({
    example: 'Requiere apoyo técnico durante la demostración',
  })
  @IsOptional()
  @IsString()
  observaciones?: string;

  @ApiProperty({ enum: ModalidadEvento, example: ModalidadEvento.PARCIAL })
  @IsEnum(ModalidadEvento)
  modalidad!: ModalidadEvento;

  @ApiPropertyOptional({
    example: [1, 2],
    description:
      'Obligatorio y no vacío si modalidad=parcial; se ignora si modalidad=total',
  })
  @ValidateIf(
    (dto: CreateEventoLaboratorioDto) =>
      dto.modalidad === ModalidadEvento.PARCIAL,
  )
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsInt({ each: true })
  @IsPositive({ each: true })
  idsEquipos?: number[];
}
