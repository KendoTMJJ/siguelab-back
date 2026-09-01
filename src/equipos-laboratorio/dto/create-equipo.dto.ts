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
import { EstadoEquipo } from '../entities/equipo.entity';

const ESTADOS_ASIGNABLES_MANUALMENTE = [
  EstadoEquipo.DISPONIBLE,
  EstadoEquipo.MANTENIMIENTO,
  EstadoEquipo.FUERA_SERVICIO,
];

export class CreateEquipoDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @IsPositive()
  idLaboratorio!: number;

  @ApiProperty({ example: 'Impresora 3D Creality K2 Plus', maxLength: 150 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nombre!: string;

  @ApiProperty({ example: 'FDM Multimaterial / Multicolor', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  tecnologia!: string;

  @ApiPropertyOptional({
    example: 1,
    description: 'Servicio del catálogo al que pertenece (ej. "Impresión 3D")',
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  idServicio?: number;

  @ApiPropertyOptional({
    example: 'disponible',
    enum: ESTADOS_ASIGNABLES_MANUALMENTE,
    default: 'disponible',
    description:
      'reservado/en_uso no son asignables manualmente: se derivan del calendario de servicios/eventos',
  })
  @IsOptional()
  @IsIn(ESTADOS_ASIGNABLES_MANUALMENTE)
  estado?: EstadoEquipo;
}
