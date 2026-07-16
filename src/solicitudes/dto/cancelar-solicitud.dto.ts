import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CancelarSolicitudDto {
  @ApiPropertyOptional({ example: 'Se canceló la práctica de laboratorio' })
  @IsOptional()
  @IsString()
  motivoCancelacion?: string;
}
