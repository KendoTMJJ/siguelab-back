import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RechazarEventoDto {
  @ApiProperty({
    example: 'Ya hay un evento aprobado que cruza en ese horario',
  })
  @IsString()
  @IsNotEmpty()
  motivo!: string;
}
