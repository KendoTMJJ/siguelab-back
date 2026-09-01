import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsPositive,
  Matches,
  ValidateNested,
} from 'class-validator';

const HORA_REGEX = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

export class ProgramacionEquipoDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @IsPositive()
  idEquipo!: number;

  @ApiProperty({ example: '2026-08-20' })
  @IsDateString()
  fecha!: string;

  @ApiProperty({ example: '08:00' })
  @Matches(HORA_REGEX, { message: 'horaInicio debe tener formato HH:mm' })
  horaInicio!: string;

  @ApiProperty({ example: '10:00' })
  @Matches(HORA_REGEX, { message: 'horaFin debe tener formato HH:mm' })
  horaFin!: string;
}

export class ProgramarServicioDto {
  @ApiProperty({
    type: [ProgramacionEquipoDto],
    description:
      'Un renglón por cada equipo que quedó en la cotización — todos deben tener fecha/horario asignado',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ProgramacionEquipoDto)
  equipos!: ProgramacionEquipoDto[];
}
