import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class CreateFacultadEnDivisionDto {
  @ApiProperty({ example: 'Ingeniería Electrónica', maxLength: 150 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nombre!: string;
}

export class CreateDivisionDto {
  @ApiProperty({ example: 'Arquitectura e Ingenierías', maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nombre!: string;

  @ApiProperty({
    type: [CreateFacultadEnDivisionDto],
    description:
      'Una división debe tener al menos una facultad — se crean junto con la división en la misma transacción.',
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'La división debe tener al menos una facultad' })
  @ValidateNested({ each: true })
  @Type(() => CreateFacultadEnDivisionDto)
  facultades!: CreateFacultadEnDivisionDto[];
}
