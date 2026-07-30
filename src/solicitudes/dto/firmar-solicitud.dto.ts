import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class FirmarSolicitudDto {
  @ApiPropertyOptional({ example: 'Confirmado, recuerden traer bata y guantes.' })
  @IsOptional()
  @IsString()
  observacion?: string;
}
