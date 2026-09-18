import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * PATCH /usuarios/me — cualquier usuario autenticado (ver UsuariosController,
 * sin @Roles). A diferencia de UpdateUsuarioDto, acá `nombre` es obligatorio
 * (es el único campo del endpoint) y no existe `idRol`: nadie puede
 * cambiarse su propio rol por esta vía, solo un admin desde PATCH /usuarios/:id.
 */
export class UpdateUsuarioPropioDto {
  @ApiProperty({ example: 'Ana María Pérez', maxLength: 150 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nombre!: string;
}
