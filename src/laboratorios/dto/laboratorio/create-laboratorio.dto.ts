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
import { EstadoLaboratorio } from '../../entities/laboratorio.entity';

export class CreateLaboratorioDto {
  @ApiProperty({ example: 'Lab. Electrónica Digital', maxLength: 150 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nombre!: string;

  @ApiProperty({ example: 24, description: 'Aforo del laboratorio' })
  @IsInt()
  @IsPositive()
  capacidad!: number;

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
}
