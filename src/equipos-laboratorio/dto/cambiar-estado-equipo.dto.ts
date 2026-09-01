import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { EstadoEquipo } from '../entities/equipo.entity';

export class CambiarEstadoEquipoDto {
  @ApiProperty({
    example: 'mantenimiento',
    enum: [
      EstadoEquipo.DISPONIBLE,
      EstadoEquipo.MANTENIMIENTO,
      EstadoEquipo.FUERA_SERVICIO,
    ],
  })
  @IsIn([
    EstadoEquipo.DISPONIBLE,
    EstadoEquipo.MANTENIMIENTO,
    EstadoEquipo.FUERA_SERVICIO,
  ])
  estado!: EstadoEquipo;
}
