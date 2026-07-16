import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateTipoReservaDto {
  @ApiProperty({ example: 'Docencia', maxLength: 80 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  nombre!: string;

  @ApiPropertyOptional({
    example: true,
    default: false,
    description:
      'Si es true, bloquea el laboratorio completo (no comparte aforo).',
  })
  @IsOptional()
  @IsBoolean()
  esExclusiva?: boolean;

  @ApiPropertyOptional({
    example: true,
    default: false,
    description:
      'Si es true, obliga a elegir un espacio académico al reservar.',
  })
  @IsOptional()
  @IsBoolean()
  requiereEspacio?: boolean;
}
