import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RechazarSolicitudDto {
  @ApiProperty({ example: 'El docente no confirmó la práctica a tiempo' })
  @IsString()
  @IsNotEmpty()
  motivo!: string;
}
