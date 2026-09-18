import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

/**
 * PATCH /usuarios/:id — exclusivo del admin (ver @Roles en el controller).
 * Ambos campos son opcionales (patch parcial de verdad): el admin puede
 * mandar solo el rol, solo el nombre, o los dos juntos. El correo sigue sin
 * ser editable: lo resuelve Entra ID en el primer login (ver
 * UsuariosService.findOrCreateByOid) y es el enlace estable con esa cuenta,
 * cambiarlo a mano rompería ese enlace.
 */
export class UpdateUsuarioDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  idRol?: string;

  @ApiPropertyOptional({ example: 'Ana María Pérez', maxLength: 150 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nombre?: string;
}
