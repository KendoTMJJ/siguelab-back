import { ApiProperty } from '@nestjs/swagger';
import { IsInt } from 'class-validator';

export class CreateEspacioLaboratorioDto {
  @ApiProperty({ example: 1, description: 'id_espacio a asociar' })
  @IsInt()
  idEspacio!: number;
}
