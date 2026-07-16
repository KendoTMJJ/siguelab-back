import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CreateDocenteLaboratorioDto {
  @ApiProperty({
    example: 'b1f0c1d2-1111-4a2b-9c3d-000000000001',
    description: 'id_usuario del docente a asociar',
  })
  @IsUUID()
  idUsuario!: string;
}
