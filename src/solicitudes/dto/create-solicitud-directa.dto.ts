import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import { CreateSolicitudDto } from './create-solicitud.dto';

/**
 * POST /solicitudes/directa (solo admin): mismos campos y reglas de
 * disponibilidad que CreateSolicitudDto, pero la solicitud queda aprobada
 * de inmediato (sin firmas pendientes) y sin exigir la antelación mínima
 * (RESERVA_ANTELACION_DIAS). idDocenteEncargado sigue siendo obligatorio
 * porque la columna es NOT NULL y de él depende la validación de que el
 * docente esté asociado al laboratorio.
 */
export class CreateSolicitudDirectaDto extends CreateSolicitudDto {
  @ApiProperty({ example: 'b1f0c1d2-1111-4a2b-9c3d-000000000001' })
  @IsUUID()
  declare idDocenteEncargado: string;
}
