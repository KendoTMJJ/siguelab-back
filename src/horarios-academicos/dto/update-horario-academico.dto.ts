import { PartialType } from '@nestjs/mapped-types';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { EstadoHorario } from '../entities/horario-academico.entity';
import { CreateHorarioAcademicoDto } from './create-horario-academico.dto';

const ESTADOS_HORARIO = Object.values(EstadoHorario);

export class UpdateHorarioAcademicoDto extends PartialType(
  CreateHorarioAcademicoDto,
) {
  @ApiPropertyOptional({
    example: 'inactivo',
    enum: ESTADOS_HORARIO,
    description:
      'El "borrado" de un horario es marcarlo inactivo (no hay DELETE)',
  })
  @IsOptional()
  @IsIn(ESTADOS_HORARIO)
  estado?: EstadoHorario;
}
