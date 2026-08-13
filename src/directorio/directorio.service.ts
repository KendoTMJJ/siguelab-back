import { Injectable } from '@nestjs/common';
import { UsuariosService } from 'src/usuarios/usuarios.service';
import { ActualizarDirectorioDto } from './dto/actualizar-directorio.dto';
import { AuthenticatedUser } from 'src/auth/decorators/current-user.decorator';

/**
 * Orquesta la sincronización de info de directorio institucional (cargo,
 * facultad). No sabe nada de Microsoft Graph ni de MSAL: solo recibe datos
 * ya resueltos por el frontend y los delega a UsuariosService, único dueño
 * del repositorio de Usuario. Si el día de mañana cambia el origen de estos
 * datos (otro IdP, sync desde el backend, etc.), este módulo no cambia.
 */
@Injectable()
export class DirectorioService {
  constructor(private readonly usuariosService: UsuariosService) {}

  async actualizarPropio(
    usuarioActual: AuthenticatedUser,
    dto: ActualizarDirectorioDto,
  ) {
    const usuario = await this.usuariosService.actualizarInfoDirectorio(
      usuarioActual.id,
      dto,
    );

    return {
      cargo: usuario.cargo ?? null,
      facultad: usuario.facultad ?? null,
    };
  }
}
