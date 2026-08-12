import { PartialType } from '@nestjs/mapped-types';
import { CreateUsuarioDto } from './create-usuario.dto';

/**
 * PATCH /usuarios/:id — exclusivo del admin (ver @Roles en el controller):
 * puede editar nombre/correo/rol de cualquier usuario. Nunca incluye
 * contraseña ni oid: la identidad la resuelve Entra ID en cada login (ver
 * JwtStrategy.validate / UsuariosService.findOrCreateByOid).
 */
export class UpdateUsuarioDto extends PartialType(CreateUsuarioDto) {}
