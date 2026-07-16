import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { DiaSemana } from '../entities/horario-academico.entity';

const HORA_REGEX = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
const DIAS_SEMANA = Object.values(DiaSemana);

export class CreateHorarioAcademicoDto {
  @ApiProperty({ example: 1, description: 'id_laboratorio' })
  @IsInt()
  idLaboratorio!: number;

  @ApiProperty({ example: 1, description: 'id_espacio (materia)' })
  @IsInt()
  idEspacio!: number;

  @ApiPropertyOptional({
    example: 'b1f0c1d2-1111-4a2b-9c3d-000000000001',
    description: 'id_docente (opcional; si viene, debe tener rol docente)',
  })
  @IsOptional()
  @IsUUID()
  idDocente?: string;

  @ApiProperty({ example: 1, description: 'id_periodo' })
  @IsInt()
  idPeriodo!: number;

  @ApiPropertyOptional({ example: 'G1', maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  grupoAsignatura?: string;

  @ApiProperty({ example: 'lunes', enum: DIAS_SEMANA })
  @IsIn(DIAS_SEMANA)
  diaSemana!: DiaSemana;

  @ApiProperty({ example: '08:00' })
  @Matches(HORA_REGEX, { message: 'horaInicio debe tener formato HH:mm' })
  horaInicio!: string;

  @ApiProperty({ example: '10:00' })
  @Matches(HORA_REGEX, { message: 'horaFin debe tener formato HH:mm' })
  horaFin!: string;
}
