import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateEspacioAcademicoDto {
  @ApiProperty({ example: 'Electrónica Digital II', maxLength: 150 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nombre!: string;

  @ApiPropertyOptional({ example: 'ELEC-204', maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  codigo?: string;
}
