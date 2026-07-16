import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateFacultadDto {
  @ApiProperty({ example: 'Ingeniería Electrónica', maxLength: 150 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nombre!: string;

  @ApiProperty({ example: 1, description: 'id_division al que pertenece' })
  @IsInt()
  idDivision!: number;
}
