import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  Matches,
  Min,
} from 'class-validator';
import {
  OBSERVACIONES_LISTA_CERRADA,
  USO_LABORATORIO_LISTA_CERRADA,
} from 'src/reportes/constantes/asistencias-excel.constants';

const HORA_REGEX = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

export class CreateRegistroUsoDto {
  @ApiPropertyOptional({
    example: 1,
    description: 'Solicitud aprobada que originó el uso (opcional)',
  })
  @IsOptional()
  @IsInt()
  idSolicitud?: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  idLaboratorio!: number;

  @ApiProperty({ example: 1, description: 'id_tipo (tipo de reserva)' })
  @IsInt()
  idTipo!: number;

  @ApiProperty({ example: '2026-08-10' })
  @IsDateString()
  fecha!: string;

  @ApiProperty({ example: '08:00' })
  @Matches(HORA_REGEX, { message: 'horaInicioReal debe tener formato HH:mm' })
  horaInicioReal!: string;

  @ApiProperty({ example: '10:00' })
  @Matches(HORA_REGEX, { message: 'horaFinReal debe tener formato HH:mm' })
  horaFinReal!: string;

  @ApiPropertyOptional({ example: 10, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  numAsistentes?: number;

  /** Alimenta la columna "Observaciones" del Excel de asistencias (ver
   * reportes/constantes/asistencias-excel.constants.ts) — por eso es
   * obligatorio y se restringe a la lista cerrada que ese archivo exige,
   * para que el Excel siempre reciba un valor válido. */
  @ApiProperty({ example: 'Ninguno', enum: OBSERVACIONES_LISTA_CERRADA })
  @IsIn(OBSERVACIONES_LISTA_CERRADA)
  observaciones!: string;

  /** Alimenta la columna "Uso de Laboratorio" del Excel de asistencias — el
   * laboratorista la elige libremente entre las 8 categorías cerradas, sin
   * quedar atado a lo que mapea "Tipo de reserva" (idTipo). */
  @ApiProperty({ example: 'Docencia', enum: USO_LABORATORIO_LISTA_CERRADA })
  @IsIn(USO_LABORATORIO_LISTA_CERRADA)
  usoLaboratorio!: string;
}
