import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreatePeriodoAcademicoDto {
  @ApiProperty({ example: '2026-2', maxLength: 20 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  nombre!: string;

  @ApiProperty({ example: '2026-07-20' })
  @IsDateString()
  fechaInicio!: string;

  @ApiProperty({ example: '2026-11-20' })
  @IsDateString()
  fechaFin!: string;

  @ApiPropertyOptional({ example: 16, default: 16 })
  @IsOptional()
  @IsInt()
  @IsPositive()
  numSemanas?: number;
}
