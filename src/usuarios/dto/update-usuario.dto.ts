import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

/**
 * PATCH /usuarios/:id — exclusivo del admin (ver @Roles en el controller):
 * lo ÚNICO editable es el rol. El nombre y el correo los resuelve Entra ID
 * en cada login (ver JwtStrategy.validate / UsuariosService.findOrCreateByOid),
 * así que editarlos aquí no tendría efecto — el próximo login los
 * sobrescribiría. Con `forbidNonWhitelisted: true` global (src/main.ts),
 * mandar nombre/correo en el body hace que la petición se rechace con 400.
 */
export class UpdateUsuarioDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  idRol!: string;
}
