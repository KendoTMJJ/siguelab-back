import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  EstadoLaboratorio,
  ModoReservaLaboratorio,
} from '../../entities/laboratorio.entity';

export class CreateLaboratorioDto {
  @ApiProperty({ example: 'Lab. Electrónica Digital', maxLength: 150 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nombre!: string;

  @ApiPropertyOptional({
    example: 24,
    description:
      'Aforo del laboratorio. Obligatorio en modo "estandar" (define los cupos de SolicitudReserva); no aplica en modo "laboratorio_como_servicio" — si se envía, el service lo ignora (ver LaboratoriosService.validarCapacidadPorModo).',
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  capacidad?: number;

  @ApiPropertyOptional({ example: 'Bloque A, piso 2', maxLength: 150 })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  ubicacion?: string;

  @ApiPropertyOptional({
    example: 'activo',
    enum: ['activo', 'inactivo'],
    default: 'activo',
  })
  @IsOptional()
  @IsIn(['activo', 'inactivo'])
  estado?: EstadoLaboratorio;

  @ApiPropertyOptional({
    example: 'estandar',
    enum: ['estandar', 'laboratorio_como_servicio'],
    default: 'estandar',
    description:
      'A qué flujo de reserva manda el frontend al elegir este laboratorio',
  })
  @IsOptional()
  @IsIn(['estandar', 'laboratorio_como_servicio'])
  modoReserva?: ModoReservaLaboratorio;
}
