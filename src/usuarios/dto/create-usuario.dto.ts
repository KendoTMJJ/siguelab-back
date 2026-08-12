import { IsEmail, IsNotEmpty, IsString, IsUUID } from 'class-validator';

/**
 * El admin pre-crea usuarios por correo (típicamente para dejarles un rol
 * distinto al de estudiante desde ya). Sin contraseña: la identidad la
 * valida Entra ID; el `oid` se enlaza solo en el primer login de esa
 * persona (ver UsuariosService.findOrCreateByOid).
 */
export class CreateUsuarioDto {
  @IsUUID()
  idRol!: string;

  @IsString()
  @IsNotEmpty()
  nombre!: string;

  @IsEmail()
  correo!: string;
}
