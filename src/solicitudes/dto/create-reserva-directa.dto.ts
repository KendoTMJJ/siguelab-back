import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
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
 * Idéntico a CreateSolicitudDto salvo que idDocenteEncargado es opcional
 * (una reserva directa de admin no necesariamente está atada a un docente) —
 * ver SolicitudesService.crearDirecta.
 */
export class CreateReservaDirectaDto {
  @ApiPropertyOptional({ example: 'b1f0c1d2-1111-4a2b-9c3d-000000000001' })
  @IsOptional()
  @IsUUID()
  idDocenteEncargado?: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  idLaboratorio!: number;

  @ApiProperty({ example: 1, description: 'id_tipo (tipo de reserva)' })
  @IsInt()
  idTipo!: number;

  @ApiPropertyOptional({
    example: 1,
    description: 'Obligatorio solo si el tipo de reserva lo exige',
  })
  @IsOptional()
  @IsInt()
  idEspacio?: number;

  @ApiProperty({
    example: 1,
    description: 'id_facultad (trazabilidad)',
  })
  @IsInt()
  idFacultad!: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  idPeriodo!: number;

  @ApiPropertyOptional({ example: 'G1', maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  grupoAsignatura?: string;

  @ApiPropertyOptional({
    example: 3,
    description: 'Solo válido si el tipo de reserva es exclusivo',
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  numGruposTrabajo?: number;

  @ApiProperty({ example: '2026-08-10' })
  @IsDateString()
  fechaPractica!: string;

  @ApiProperty({ example: '08:00' })
  @Matches(HORA_REGEX, { message: 'horaInicio debe tener formato HH:mm' })
  horaInicio!: string;

  @ApiProperty({ example: '10:00' })
  @Matches(HORA_REGEX, { message: 'horaFin debe tener formato HH:mm' })
  horaFin!: string;

  @ApiProperty({ example: 'Mantenimiento preventivo', maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  nombrePractica!: string;

  @ApiProperty({ example: 10 })
  @IsInt()
  @IsPositive()
  numPersonas!: number;

  @ApiPropertyOptional({
    example: 5,
    description: '1 ≤ semana ≤ num_semanas del período',
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  semana?: number;

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
}
