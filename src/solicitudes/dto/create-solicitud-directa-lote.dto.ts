import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

const HORA_REGEX = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

/**
 * POST /solicitudes/directa-lote (admin/laboratorista): "reserva especial"
 * de varios días — los MISMOS campos que CreateSolicitudDto (tipo, horario,
 * aforo, docente encargado, facultad, periodo...), salvo que en vez de una
 * sola `fechaPractica` se manda un arreglo `fechas` y el mismo horario se
 * aplica a todas — cada fecha se valida y se crea como una SolicitudReserva
 * independiente (ver SolicitudesService.crearDirectaLote), agrupadas por
 * `idLoteEspecial`. Queda aprobada de inmediato, igual que crearDirecta (sin
 * idLaboratoristaEncargado: no hay paso pendiente que asignarle a nadie).
 *
 * `responsable` es el único campo nuevo frente a una reserva normal: texto
 * libre para el nombre de quien organiza el evento — quien arma una reserva
 * especial normalmente NO es un docente asociado al laboratorio (es un
 * comité, una dependencia externa, etc.), así que no alcanza con
 * idDocenteEncargado (que sigue exigiendo un docente real ya asociado).
 *
 * Todo o nada: si cualquier fecha del arreglo no tiene disponibilidad, no se
 * crea ninguna solicitud del lote.
 */
export class CreateSolicitudDirectaLoteDto {
  @ApiProperty({ example: 'b1f0c1d2-1111-4a2b-9c3d-000000000001' })
  @IsUUID()
  idDocenteEncargado!: string;

  @ApiProperty({
    example: 'Comité de Bienestar Universitario',
    maxLength: 200,
    description:
      'Nombre de quien organiza/responde por el evento — no necesariamente un docente del sistema.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  responsable!: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  idLaboratorio!: number;

  @ApiProperty({ example: 1, description: 'id_tipo (tipo de reserva)' })
  @IsInt()
  idTipo!: number;

  @ApiProperty({
    example: 1,
    description:
      'Obligatorio para cualquier tipo de reserva (formato EATUF) — mismo criterio que CreateSolicitudDto.',
  })
  @IsInt()
  idEspacio!: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  idFacultad!: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  idPeriodo!: number;

  @ApiProperty({
    example: 'G1',
    maxLength: 20,
    description: 'Obligatorio para cualquier tipo de reserva (formato EATUF).',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  grupoAsignatura!: string;

  @ApiProperty({
    example: 3,
    description: 'Obligatorio para cualquier tipo de reserva (formato EATUF).',
  })
  @IsInt()
  @IsPositive()
  numGruposTrabajo!: number;

  @ApiProperty({ example: '08:00' })
  @Matches(HORA_REGEX, { message: 'horaInicio debe tener formato HH:mm' })
  horaInicio!: string;

  @ApiProperty({ example: '10:00' })
  @Matches(HORA_REGEX, { message: 'horaFin debe tener formato HH:mm' })
  horaFin!: string;

  @ApiProperty({ example: 'Feria de ciencias', maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  nombrePractica!: string;

  @ApiProperty({ example: 10 })
  @IsInt()
  @IsPositive()
  numPersonas!: number;

  @ApiPropertyOptional({ example: 'Ácido clorhídrico, agua destilada' })
  @IsOptional()
  @IsString()
  reactivosSustancias?: string;

  @ApiPropertyOptional({ example: 'Multímetro, osciloscopio' })
  @IsOptional()
  @IsString()
  equiposInsumos?: string;

  @ApiPropertyOptional({ example: 'Guantes de nitrilo' })
  @IsOptional()
  @IsString()
  materialesEstudiante?: string;

  @ApiProperty({
    example: ['2026-10-12', '2026-10-13', '2026-10-14'],
    description: 'Un día por elemento — sin duplicados, mínimo 1, máximo 31.',
  })
  @IsDateString({}, { each: true })
  @ArrayUnique()
  @ArrayMinSize(1)
  @ArrayMaxSize(31)
  fechas!: string[];
}
