import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { NivelFacultad } from '../../entities/facultad.entity';

export class CreateFacultadDto {
  @ApiProperty({ example: 'Ingeniería Electrónica', maxLength: 150 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nombre!: string;

  @ApiProperty({ example: 1, description: 'id_division al que pertenece' })
  @IsInt()
  idDivision!: number;

  @ApiPropertyOptional({
    example: NivelFacultad.PREGRADO,
    enum: NivelFacultad,
    description: 'Por defecto pregrado si no se envía',
  })
  @IsOptional()
  @IsEnum(NivelFacultad)
  nivel?: NivelFacultad;
}
