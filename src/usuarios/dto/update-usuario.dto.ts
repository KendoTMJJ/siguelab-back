import { PartialType } from '@nestjs/mapped-types';
import { CreateUsuarioDto } from './create-usuario.dto';

/**
 * PATCH /usuarios/:id — exclusivo del admin (ver @Roles en el controller):
 * puede editar cualquier campo de cualquier usuario, incluido el correo.
 * La restricción de "no se puede cambiar el correo" aplica solo a la
 * autoedición (PATCH /auth/me, ver UpdateMeDto) — el admin gestionando
 * OTROS usuarios sí necesita poder corregir un correo mal escrito.
 */
export class UpdateUsuarioDto extends PartialType(CreateUsuarioDto) {}
