import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CancelarEventoDto {
  @ApiProperty({ example: 'El evento se reprogramó para otra fecha' })
  @IsString()
  @IsNotEmpty()
  motivo!: string;
}
