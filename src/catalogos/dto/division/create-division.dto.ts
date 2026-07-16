import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateDivisionDto {
  @ApiProperty({ example: 'Arquitectura e Ingenierías', maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nombre!: string;
}
