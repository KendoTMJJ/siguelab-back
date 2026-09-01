import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';

export class CreateServicioTecnologicoDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @IsPositive()
  idLaboratorio!: number;

  @ApiProperty({
    example: 1,
    description:
      'Servicio del catálogo de ese laboratorio (ej. "Impresión 3D")',
  })
  @IsInt()
  @IsPositive()
  idServicioSolicitado!: number;

  @ApiProperty({
    example:
      'Necesito imprimir una carcasa para un prototipo de mi proyecto de grado, en PLA, tamaño aproximado 10x10x5cm.',
  })
  @IsString()
  @IsNotEmpty()
  descripcion!: string;

  @ApiPropertyOptional({
    example: 1,
    description:
      'Sugerencia opcional, no vinculante — el técnico define el/los equipo(s) reales al cotizar',
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  idEquipoSugerido?: number;
}
