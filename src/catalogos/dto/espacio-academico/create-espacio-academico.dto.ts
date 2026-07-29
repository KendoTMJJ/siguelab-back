import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateEspacioAcademicoDto {
  @ApiProperty({ example: 'Electrónica Digital II', maxLength: 150 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nombre!: string;
}
