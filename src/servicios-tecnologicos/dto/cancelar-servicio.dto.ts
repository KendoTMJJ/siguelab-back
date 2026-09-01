import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CancelarServicioDto {
  @ApiProperty({
    example: 'Ya no necesito la pieza, el proyecto cambió de alcance',
  })
  @IsString()
  @IsNotEmpty()
  motivo!: string;
}
