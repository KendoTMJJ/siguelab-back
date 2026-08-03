import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

/**
 * Autoedición (PATCH /auth/me): a propósito solo nombre y contraseña — ni
 * correo ni idRol/estado son editables por el propio usuario (ver
 * UsuariosService.updateSelf). Cambiar el rol o desactivarse a sí mismo
 * sigue siendo exclusivo del admin vía PATCH /usuarios/:id.
 */
export class UpdateMeDto {
  @ApiPropertyOptional({ example: 'Nombre Nuevo' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  nombre?: string;

  @ApiPropertyOptional({
    description: 'Obligatoria si se envía nuevaContrasena',
  })
  @IsOptional()
  @IsString()
  contrasenaActual?: string;

  @ApiPropertyOptional({ minLength: 8 })
  @IsOptional()
  @IsString()
  @MinLength(8)
  nuevaContrasena?: string;
}
