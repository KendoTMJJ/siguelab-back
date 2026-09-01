import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';
import { EstadoServicio } from '../entities/servicio.entity';

export class CreateServicioDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @IsPositive()
  idLaboratorio!: number;

  @ApiProperty({ example: 'Impresión 3D', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nombre!: string;

  @ApiPropertyOptional({ enum: EstadoServicio, default: EstadoServicio.ACTIVO })
  @IsOptional()
  @IsEnum(EstadoServicio)
  estado?: EstadoServicio;
}
